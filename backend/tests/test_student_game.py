"""API game "Hào Khí Đông A": server chấm câu hỏi, cộng Ấn Tín/XP, lưu trạng thái game, bảng lớp của giáo viên.

Chạy từ thư mục gốc dự án:  python -m unittest discover -s backend/tests -v
Dùng SQLite tạm, không đụng tới dữ liệu thật.
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND = Path(__file__).resolve().parents[1]
_TMP = tempfile.TemporaryDirectory(prefix="dong_a_game_test_")
os.environ["USERS_DB_PATH"] = str(Path(_TMP.name) / "users.db")
os.environ["AUTH_SECRET_KEY"] = "game-test-secret"
os.environ["DATABASE_URL"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["HF_TOKEN"] = ""
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402

from app.core import progress as prog  # noqa: E402
from app.core.question_bank import question_bank  # noqa: E402
from app.main import app  # noqa: E402
from database.user_store import store  # noqa: E402


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def first(qtype: str, unit: str | None = None) -> dict:
    return next(q for q in question_bank.questions.values() if q["type"] == qtype and (unit is None or q["unit_id"] == unit))


def right_payload(q: dict) -> dict:
    if q["type"] in ("mcq", "map", "tf"):
        return {"choice": q["answer"]}
    if q["type"] == "order":
        return {"order": list(range(len(q["items"])))}
    return {"pairs": {str(i): i for i in range(len(q["left"]))}}


def wrong_payload(q: dict) -> dict:
    if q["type"] == "mcq":
        return {"choice": (q["answer"] + 1) % len(q["options"])}
    if q["type"] == "map":
        return {"choice": next(o for o in q["options"] if o != q["answer"])}
    if q["type"] == "tf":
        return {"choice": not q["answer"]}
    if q["type"] == "order":
        return {"order": list(reversed(range(len(q["items"]))))}
    n = len(q["left"])
    return {"pairs": {str(i): (i + 1) % n for i in range(n)}}


class StudentGameApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()
        c = cls.client
        admin = c.post("/api/auth/login", json={"username": "admin", "password": "admin@123", "portal": "admin"}).json()
        h = auth(admin["token"])
        teacher = c.post("/api/admin/users", json={"full_name": "Trần Thị Hoa", "role": "teacher", "class_name": "7A1"}, headers=h).json()
        students = c.post("/api/admin/users/bulk", json={"role": "student", "class_name": "7A1", "full_names": ["Nguyễn Văn Long", "Đỗ Bảo Ngọc"]}, headers=h).json()

        def login(username, password, portal, new_password):
            r = c.post("/api/auth/login", json={"username": username, "password": password, "portal": portal}).json()
            r = c.post("/api/auth/change-password", json={"current_password": password, "new_password": new_password}, headers=auth(r["token"])).json()
            return auth(r["token"]), r["user"]

        cls.T, _ = login(teacher["user"]["username"], teacher["password"], "teacher", "giaovien1")
        cls.S0, cls.u0 = login(students[0]["user"]["username"], students[0]["password"], "student", "hocsinh1")
        cls.S1, cls.u1 = login(students[1]["user"]["username"], students[1]["password"], "student", "hocsinh2")

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def answer(self, headers, q, payload):
        r = self.client.post("/api/student/answer", json={"question_id": q["id"], **payload}, headers=headers)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    # ------------------------------------------------------------------ tiến độ & câu hỏi
    def test_01_new_student_progress(self):
        p = self.client.get("/api/student/progress", headers=self.S0).json()
        self.assertEqual((p["xp"], p["gems"], p["week_xp"], p["day_gems"]), (0, 100, 0, 0))
        self.assertTrue(p["freeze_available"])
        self.assertEqual(p["daily_gem_cap"], prog.DAILY_GEM_CAP)
        self.assertNotIn("pig_state", p)

    def test_02_served_questions_hide_answers(self):
        r = self.client.get("/api/student/questions", params={"units": "KC1_OVERVIEW,KC3_BACH_DANG_HOW", "count": 8}, headers=self.S0)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual(len(data["questions"]), 8)
        for q in data["questions"]:
            self.assertIn(q["unit_id"], ("KC1_OVERVIEW", "KC3_BACH_DANG_HOW"))
            self.assertNotIn("answer", q)
            self.assertNotIn("explanation", q)
            self.assertTrue(q["topic"])
        served = question_bank.serve(first("order"))
        self.assertNotEqual([i["key"] for i in served["items"]], list(range(len(served["items"]))), "câu sắp xếp phải bị xáo")
        excl = ",".join(question_bank.by_unit["KC1_OVERVIEW"][:-1])
        again = self.client.get("/api/student/questions", params={"units": "KC1_OVERVIEW", "count": 1, "exclude": excl}, headers=self.S0).json()
        self.assertEqual(again["questions"][0]["id"], question_bank.by_unit["KC1_OVERVIEW"][-1], "ưu tiên câu chưa gặp")

    def test_03_server_grades_every_question_type(self):
        for qtype in ("mcq", "tf", "order", "match", "map"):
            q = first(qtype)
            with self.subTest(qtype=qtype):
                self.assertTrue(self.answer(self.S1, q, right_payload(q))["correct"])
                bad = self.answer(self.S1, q, wrong_payload(q))
                self.assertFalse(bad["correct"])
                self.assertTrue(bad["explanation"])
                self.assertTrue(bad["reveal"])
        q = first("mcq")
        self.assertFalse(self.answer(self.S1, q, {"choice": True})["correct"], "true không được coi là đáp án số 1")
        self.assertEqual(self.client.post("/api/student/answer", json={"question_id": "khong-ton-tai", "choice": 0}, headers=self.S1).status_code, 404)

    def test_04_rewards_only_from_server_grading(self):
        q = first("mcq", "KC1_DONG_BO_DAU")
        before = self.client.get("/api/student/progress", headers=self.S0).json()
        ok = self.answer(self.S0, q, right_payload(q))
        self.assertEqual((ok["xp_gained"], ok["gems_gained"]), (prog.XP_CORRECT, prog.GEMS_CORRECT))
        self.assertGreater(ok["new_p_l"], ok["old_p_l"])
        self.assertEqual(ok["progress"]["gems"], before["gems"] + prog.GEMS_CORRECT)
        self.assertEqual(ok["progress"]["week_xp"], before["week_xp"] + prog.XP_CORRECT)
        self.assertEqual(ok["progress"]["streak"], 1)
        bad = self.answer(self.S0, q, wrong_payload(q))
        self.assertEqual((bad["xp_gained"], bad["gems_gained"]), (prog.XP_WRONG, 0))
        # Đã làm và còn yếu -> câu đúng tiếp theo thuộc cụm đó được thưởng nhiều hơn
        weak = self.answer(self.S0, q, right_payload(q))
        self.assertEqual(weak["gems_gained"], prog.GEMS_CORRECT_WEAK)
        # Không được tự cộng Ấn Tín
        self.assertEqual(self.client.post("/api/student/gems", json={"delta": 500}, headers=self.S0).status_code, 422)
        spent = self.client.post("/api/student/gems", json={"delta": -20, "reason": "chieu_mo"}, headers=self.S0).json()
        self.assertEqual(spent["gems"], weak["progress"]["gems"] - 20)
        self.assertEqual(self.client.post("/api/student/gems", json={"delta": -99999}, headers=self.S0).status_code, 400)

    def test_05_daily_gem_cap(self):
        p = store.get_progress(self.u1["id"])
        prog.roll_day(p)
        p["day_gems"] = prog.DAILY_GEM_CAP - 4
        store.save_progress(self.u1["id"], p)
        q = first("tf", "KC1_VUON_KHONG_NHA_TRONG")
        self.assertEqual(self.answer(self.S1, q, right_payload(q))["gems_gained"], 4)
        res = self.answer(self.S1, q, right_payload(q))
        self.assertEqual(res["gems_gained"], 0)
        self.assertEqual(res["xp_gained"], prog.XP_CORRECT, "hết trần Ấn Tín vẫn được XP")
        self.assertEqual(res["progress"]["day_gems"], prog.DAILY_GEM_CAP)

    def test_06_weak_mode_and_ai_fallback(self):
        q = first("mcq", "KC2_TRAN_BINH_TRONG")
        self.assertLess(self.answer(self.S0, q, wrong_payload(q))["new_p_l"], prog.WEAK_THRESHOLD)
        r = self.client.get("/api/student/questions", params={"mode": "weak", "count": 3}, headers=self.S0).json()
        self.assertEqual(r["mode"], "weak")
        self.assertIn("KC2_TRAN_BINH_TRONG", r["units"], "cụm vừa làm sai phải được ưu tiên ôn")
        self.assertTrue(all(x["unit_id"] in r["units"] for x in r["questions"]))
        ai = self.client.post("/api/student/questions/ai", json={"unit_id": "KC3_VAN_DON", "count": 2}, headers=self.S0)
        self.assertEqual(ai.status_code, 200, ai.text)
        qs = ai.json()["questions"]
        self.assertTrue(qs)
        # Không có khóa AI: không dùng câu dự phòng lạc chủ đề, chỉ dùng câu của đúng cụm tri thức
        self.assertTrue(all(q["unit_id"] == "KC3_VAN_DON" and not q["id"].startswith("q-fallback") for q in qs))
        self.assertTrue(all(q["id"] in question_bank.by_unit["KC3_VAN_DON"] or q["id"].startswith("ai-") for q in qs))
        graded = self.client.post("/api/student/answer", json={"question_id": qs[0]["id"], "choice": qs[0]["options"][0]["key"]}, headers=self.S0)
        self.assertEqual(graded.status_code, 200, graded.text)

    def test_07_quiz_complete_matches_server_answers(self):
        too_many = self.client.post("/api/student/quiz-complete", json={"correct": 49, "total": 50}, headers=self.S0)
        self.assertEqual(too_many.status_code, 400)
        res = self.client.post("/api/student/quiz-complete", json={"correct": 2, "total": 2}, headers=self.S0).json()
        self.assertTrue(res["perfect"])
        self.assertEqual(res["progress"]["lessons_completed"], 1)

    # ------------------------------------------------------------------ trạng thái game & Sử Ký
    def test_08_game_state_round_trip_and_limit(self):
        self.assertIsNone(self.client.get("/api/student/game", headers=self.S0).json()["state"])
        state = {"v": 1, "campaign": {"m1p1": 3, "m1p2": 2, "m2p1": 1}, "heroes": {"tran_thai_tong": {"stage": 1}}}
        self.assertEqual(self.client.put("/api/student/game", json={"state": state}, headers=self.S0).status_code, 200)
        self.assertEqual(self.client.get("/api/student/game", headers=self.S0).json()["state"], state)
        big = {"blob": "x" * 17_000}
        self.assertEqual(self.client.put("/api/student/game", json={"state": big}, headers=self.S0).status_code, 413)
        self.assertEqual(self.client.put("/api/student/game", json={"state": [1, 2]}, headers=self.S0).status_code, 422)
        # Chấm câu trả lời chỉ ghi bộ đếm, không ghi lại game_state (tránh đè bản client vừa tự lưu)
        with patch.object(store, "save_progress", wraps=store.save_progress) as spy:
            q = first("mcq")
            self.answer(self.S0, q, right_payload(q))
        self.assertTrue(spy.called)
        self.assertTrue(all("game_state" not in call.args[1] for call in spy.call_args_list))
        self.assertEqual(self.client.get("/api/student/game", headers=self.S0).json()["state"], state)

    def test_09_codex_includes_knowledge_base_and_game_topics(self):
        entries = self.client.get("/api/student/codex", headers=self.S0).json()
        units = [e["unit_id"] for e in entries]
        self.assertIn("KC3_BACH_DANG_HOW", units)
        self.assertIn("GAME_NGU_BINH_U_NONG", units)
        self.assertNotIn("INTENT_GREETING", units)
        self.assertEqual(len(units), len(set(units)))  # chủ đề bổ sung đã có trong kho tri thức: không lặp thẻ
        self.assertTrue(all(e["fact_chunk"] for e in entries))
        binh_thu = next(e for e in entries if e["unit_id"] == "GAME_BINH_THU_YEU_LUOC")
        self.assertEqual(binh_thu["source"], "Hịch tướng sĩ – Trần Quốc Tuấn")

    def test_10_leaderboard_by_week(self):
        board = self.client.get("/api/student/leaderboard", headers=self.S0).json()
        self.assertEqual(len(board), 2)
        self.assertGreaterEqual(board[0]["week_xp"], board[1]["week_xp"])
        self.assertEqual(sum(1 for e in board if e["is_me"]), 1)

    # ------------------------------------------------------------------ giáo viên
    def test_11_teacher_sees_stars_wrong_questions_and_mastery(self):
        data = self.client.get("/api/teacher/class", headers=self.T).json()
        long_ = next(s for s in data["students"] if s["id"] == self.u0["id"])
        self.assertEqual(long_["campaign_stars"], [5, 1, 0])
        self.assertEqual((long_["stars"], long_["heroes"]), (6, 1))
        self.assertIn(first("mcq", "KC1_DONG_BO_DAU")["id"], [w["question_id"] for w in data["top_wrong"]])
        self.assertTrue(any(m["unit_id"] == "KC1_DONG_BO_DAU" for m in data["unit_mastery"]))
        self.assertEqual(data["summary"]["total_stars"], 6)
        self.assertIsInstance(data["needs_support"], list)

    def test_13_parallel_first_requests_create_one_progress_row(self):
        from concurrent.futures import ThreadPoolExecutor

        u = store.create_user(username="song.song", full_name="Song Song", role="student", class_name="7A1", password_hash="khong-dung")
        with ThreadPoolExecutor(max_workers=6) as pool:
            rows = list(pool.map(lambda _: store.get_progress(u["id"]), range(6)))
        self.assertEqual({r["user_id"] for r in rows}, {u["id"]})
        self.assertTrue(all(r["gems"] == rows[0]["gems"] for r in rows))

    def test_12_role_checks(self):
        self.assertEqual(self.client.get("/api/teacher/class", headers=self.S0).status_code, 403)
        self.assertEqual(self.client.get("/api/student/questions", headers=self.T).status_code, 403)
        self.assertEqual(self.client.get("/api/student/game").status_code, 401)


class StreakTests(unittest.TestCase):
    def test_one_freeze_day_per_week(self):
        p = {"streak": 4, "last_active_date": prog._days_ago(2), "freeze_week": None}
        self.assertEqual(prog.effective_streak(p), 4)
        prog.touch_streak(p)
        self.assertEqual((p["streak"], p["freeze_week"]), (5, prog.week_key()))
        p["last_active_date"] = prog._days_ago(2)
        self.assertEqual(prog.effective_streak(p), 0, "đã dùng ngày nghỉ phép trong tuần")
        prog.touch_streak(p)
        self.assertEqual(p["streak"], 1)

    def test_award_respects_cap(self):
        p = {"xp": 0, "gems": 0, "day_gems": prog.DAILY_GEM_CAP - 5}
        self.assertEqual(prog.award_answer(p, correct=True, weak=True), (prog.XP_CORRECT, 5))
        self.assertEqual(prog.award_answer(p, correct=False, weak=False), (prog.XP_WRONG, 0))
        self.assertEqual((p["day_gems"], p["week_xp"]), (prog.DAILY_GEM_CAP, prog.XP_CORRECT + prog.XP_WRONG))


class QuestionBankFileTests(unittest.TestCase):
    def test_every_learning_unit_has_questions(self):
        kb = json.loads((BACKEND.parent / "ai" / "data" / "q_matrix.json").read_text(encoding="utf-8"))
        learning = [u for u, m in kb.items() if m["category"] not in ("CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD", "OUT_OF_DOMAIN")]
        self.assertEqual([u for u in learning if u not in question_bank.by_unit], [])
        self.assertGreaterEqual(len(question_bank.questions), 120)
        for unit in question_bank.by_unit:
            self.assertTrue(unit in kb or unit in question_bank.units, unit)


if __name__ == "__main__":
    unittest.main()
