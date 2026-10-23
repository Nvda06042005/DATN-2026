"""Thi đấu cả lớp thời gian thực qua WebSocket /api/live/ws và lịch sử trận của giáo viên.

Chạy từ thư mục gốc dự án:  python -m unittest discover -s backend/tests -v
Dùng SQLite tạm, không đụng tới dữ liệu thật. Lớp 7B9/7C9 riêng để không lẫn với test_student_game.
"""
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
_TMP = tempfile.TemporaryDirectory(prefix="dong_a_live_test_")
os.environ.setdefault("USERS_DB_PATH", str(Path(_TMP.name) / "users.db"))
os.environ.setdefault("AUTH_SECRET_KEY", "live-test-secret")
os.environ["DATABASE_URL"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["HF_TOKEN"] = ""
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import anyio  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

from app.core.live import MAX_FAILED_JOINS, hub, points_for  # noqa: E402
from app.core.question_bank import question_bank  # noqa: E402
from app.main import app  # noqa: E402


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def recv(ws, timeout: float = 5.0) -> dict:
    """Nhận một tin nhắn, báo lỗi thay vì treo test nếu server không gửi gì."""

    async def get():
        with anyio.fail_after(timeout):
            return await ws._send_rx.receive()

    message = ws.portal.call(get)
    if message["type"] == "websocket.close":
        raise WebSocketDisconnect(message.get("code", 1000))
    return json.loads(message["text"])


def until(ws, pred, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while True:
        left = deadline - time.monotonic()
        if left <= 0:
            raise AssertionError("Hết thời gian chờ tin nhắn mong đợi")
        msg = recv(ws, left)
        if pred(msg):
            return msg


def room_in(phase):
    return lambda m: m["type"] == "room" and m.get("room") and m["room"]["phase"] == phase


def state_in(phase):
    return lambda m: m["type"] == "state" and m.get("state") and m["state"]["phase"] == phase


def error(code):
    return lambda m: m["type"] == "error" and m["code"] == code


def right_key(question: dict):
    return question_bank.questions[question["id"]]["answer"]


def wrong_key(question: dict):
    answer = right_key(question)
    return next(o["key"] for o in question["options"] if not (type(o["key"]) is type(answer) and o["key"] == answer))


class LiveRoomTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()
        c = cls.client
        admin = c.post("/api/auth/login", json={"username": "admin", "password": "admin@123", "portal": "admin"}).json()
        cls.ADMIN = admin["token"]
        h = auth(admin["token"])

        def make(full_name, role, class_name, password):
            created = c.post("/api/admin/users", json={"full_name": full_name, "role": role, "class_name": class_name}, headers=h).json()
            r = c.post("/api/auth/login", json={"username": created["user"]["username"], "password": created["password"], "portal": role}).json()
            r = c.post("/api/auth/change-password", json={"current_password": created["password"], "new_password": password}, headers=auth(r["token"])).json()
            return r["token"], r["user"]

        cls.T, cls.teacher = make("Lê Văn Sử", "teacher", "7B9", "giaovien9")
        cls.T2, _ = make("Phạm Thị Chưa Lớp", "teacher", None, "giaovien8")
        cls.A, cls.a = make("Trần Minh An", "student", "7B9", "hocsinh9")
        cls.B, cls.b = make("Vũ Thu Bình", "student", "7B9", "hocsinh8")
        cls.C, _ = make("Hoàng Gia Cường", "student", "7B9", "hocsinh7")
        cls.X, _ = make("Ngô Lớp Khác", "student", "7C9", "hocsinh6")

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def tearDown(self):
        hub.question_seconds = 20

    def connect(self, token, expect_type):
        ws = self.client.websocket_connect("/api/live/ws")
        session = ws.__enter__()
        self.addCleanup(lambda: ws.__exit__(None, None, None))
        session.send_json({"type": "auth", "token": token})
        hello = recv(session)
        self.assertEqual(hello["type"], expect_type, hello)
        return session, hello

    def open_room(self, host, count=5, scope="all"):
        host.send_json({"type": "create", "title": "Ôn tập Bài 14", "count": count, "scope": scope})
        return until(host, room_in("lobby"))["room"]

    def progress(self, token):
        return self.client.get("/api/student/progress", headers=auth(token)).json()

    def wait_progress(self, token, check, timeout=5.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            p = self.progress(token)
            if check(p):
                return p
            time.sleep(0.05)
        self.fail(f"Tiến độ chưa được ghi: {self.progress(token)}")

    # ------------------------------------------------------------------ trận đầy đủ
    def test_01_full_game_scores_saves_history_and_progress(self):
        before_a, before_b = self.progress(self.A), self.progress(self.B)
        host, hello = self.connect(self.T, "room")
        self.assertIsNone(hello["room"])
        room = self.open_room(host)
        pin = room["pin"]
        self.assertRegex(pin, r"^\d{6}$")
        self.assertEqual(room["total"], 5)

        a, _ = self.connect(self.A, "state")
        b, _ = self.connect(self.B, "state")
        a.send_json({"type": "join", "pin": pin})
        self.assertEqual(until(a, state_in("lobby"))["state"]["me"]["name"], "Trần Minh An")
        b.send_json({"type": "join", "pin": pin})
        until(b, state_in("lobby"))
        lobby = until(host, lambda m: room_in("lobby")(m) and len(m["room"]["players"]) == 2)["room"]
        self.assertEqual({p["name"] for p in lobby["players"]}, {"Trần Minh An", "Vũ Thu Bình"})

        host.send_json({"type": "start"})
        for i in range(5):
            qa = until(a, lambda m: state_in("question")(m) and m["state"]["index"] == i)["state"]["question"]
            qb = until(b, lambda m: state_in("question")(m) and m["state"]["index"] == i)["state"]["question"]
            self.assertEqual(qa["id"], qb["id"])
            # Không gửi đáp án xuống máy học sinh trước khi công bố
            self.assertNotIn("answer", qa)
            self.assertTrue(all(set(o) == {"key", "text"} for o in qa["options"]))
            self.assertIn(question_bank.questions[qa["id"]]["type"], ("mcq", "tf"))

            a.send_json({"type": "answer", "question_id": qa["id"], "choice": right_key(qa)})
            mine = until(a, lambda m: state_in("question")(m) and m["state"]["me"]["answered"])["state"]["me"]
            self.assertEqual(mine["choice"], right_key(qa))
            a.send_json({"type": "answer", "question_id": qa["id"], "choice": right_key(qa)})
            until(a, error("bad_phase"))  # mỗi câu chỉ trả lời một lần
            b.send_json({"type": "answer", "question_id": qb["id"], "choice": wrong_key(qb)})

            # Cả lớp đã trả lời: server công bố đáp án ngay
            revealed = until(host, room_in("reveal"))["room"]
            self.assertEqual(revealed["answered"], 2)
            self.assertEqual(sum(revealed["reveal"]["counts"]), 2)
            ra = until(a, state_in("reveal"))["state"]
            rb = until(b, state_in("reveal"))["state"]
            self.assertTrue(ra["me"]["last_correct"])
            self.assertGreaterEqual(ra["me"]["last_gain"], 500)
            self.assertFalse(rb["me"]["last_correct"])
            self.assertEqual(rb["me"]["last_gain"], 0)
            self.assertEqual(ra["me"]["rank"], 1)

            host.send_json({"type": "next"})
            board = until(a, state_in("scoreboard"))["state"]
            self.assertEqual(board["top"][0]["name"], "Trần Minh An")
            host.send_json({"type": "next"})

        podium = until(host, room_in("podium"))["room"]
        self.assertEqual([p["name"] for p in podium["players"]], ["Trần Minh An", "Vũ Thu Bình"])
        self.assertEqual(podium["players"][0]["correct"], 5)
        self.assertEqual(podium["players"][0]["streak"], 5)
        final_b = until(b, state_in("podium"))["state"]
        self.assertEqual(final_b["me"]["rank"], 2)
        saved = until(host, lambda m: m["type"] == "room" and m.get("room") and m["room"].get("session_id"))["room"]

        history = self.client.get("/api/teacher/live-sessions", headers=auth(self.T))
        self.assertEqual(history.status_code, 200, history.text)
        session = history.json()[0]
        self.assertEqual(session["id"], saved["session_id"])
        self.assertEqual((session["title"], session["class_name"], session["question_count"], session["player_count"]), ("Ôn tập Bài 14", "7B9", 5, 2))
        self.assertEqual([(r["full_name"], r["rank"], r["correct"], r["answered"]) for r in session["results"]], [("Trần Minh An", 1, 5, 5), ("Vũ Thu Bình", 2, 0, 5)])
        self.assertEqual(len(session["questions"]), 5)
        self.assertTrue(all((q["answered"], q["correct"]) == (2, 1) for q in session["questions"]))
        self.assertEqual(session["accuracy"], 0.5)
        # Học sinh không xem được lịch sử của giáo viên
        self.assertEqual(self.client.get("/api/teacher/live-sessions", headers=auth(self.A)).status_code, 403)

        # Mỗi câu trả lời trong trận được ghi vào tiến độ thật như khi luyện tập
        pa = self.wait_progress(self.A, lambda p: p["lessons_completed"] == before_a["lessons_completed"] + 1 and p["questions_answered"] == before_a["questions_answered"] + 5)
        self.assertEqual(pa["questions_correct"], before_a["questions_correct"] + 5)
        self.assertEqual(pa["perfect_runs"], before_a["perfect_runs"] + 1)
        self.assertGreater(pa["xp"], before_a["xp"])
        self.assertGreater(pa["gems"], before_a["gems"])
        pb = self.wait_progress(self.B, lambda p: p["lessons_completed"] == before_b["lessons_completed"] + 1 and p["questions_answered"] == before_b["questions_answered"] + 5)
        self.assertEqual(pb["questions_correct"], before_b["questions_correct"])
        self.assertEqual(pb["gems"], before_b["gems"])

        host.send_json({"type": "close"})
        self.assertIsNone(until(host, lambda m: m["type"] == "room" and m.get("closed"))["room"])
        self.assertEqual(until(a, lambda m: m["type"] == "closed")["reason"], "host_closed")

    # ------------------------------------------------------------------ quyền và lỗi
    def test_02_permissions_pin_and_moderation(self):
        bad = self.client.websocket_connect("/api/live/ws")
        with bad as ws:
            ws.send_json({"type": "auth", "token": "khong-hop-le"})
            self.assertEqual(recv(ws)["code"], "auth")
            with self.assertRaises(WebSocketDisconnect) as closed:
                recv(ws)
            self.assertEqual(closed.exception.code, 4401)
        with self.client.websocket_connect("/api/live/ws") as ws:
            ws.send_json({"type": "auth", "token": self.ADMIN})
            self.assertEqual(recv(ws)["code"], "role")

        lone, _ = self.connect(self.T2, "room")
        lone.send_json({"type": "create", "count": 5})
        until(lone, error("no_class"))

        host, _ = self.connect(self.T, "room")
        pin = self.open_room(host)["pin"]
        host.send_json({"type": "start"})
        until(host, error("no_players"))

        other, _ = self.connect(self.X, "state")
        other.send_json({"type": "join", "pin": pin})
        until(other, error("not_found"))  # phòng của lớp khác: không cho vào, không lộ là phòng có tồn tại
        other.send_json({"type": "start"})
        until(other, error("bad_request"))

        a, _ = self.connect(self.A, "state")
        a.send_json({"type": "join", "pin": "000000" if pin != "000000" else "111111"})
        until(a, error("not_found"))
        a.send_json({"type": "answer", "question_id": "x", "choice": 0})
        until(a, error("no_room"))
        a.send_json({"type": "join", "pin": pin})
        until(a, state_in("lobby"))
        b, _ = self.connect(self.B, "state")
        b.send_json({"type": "join", "pin": pin})
        until(b, state_in("lobby"))

        host.send_json({"type": "lock", "locked": True})
        until(host, lambda m: room_in("lobby")(m) and m["room"]["locked"])
        c, _ = self.connect(self.C, "state")
        c.send_json({"type": "join", "pin": pin})
        until(c, error("locked"))

        host.send_json({"type": "kick", "player_id": self.b["id"]})
        until(b, lambda m: m["type"] == "kicked")
        until(host, lambda m: room_in("lobby")(m) and len(m["room"]["players"]) == 1)
        host.send_json({"type": "lock", "locked": False})
        b.send_json({"type": "join", "pin": pin})
        until(b, error("banned"))

        host.send_json({"type": "start"})
        q = until(a, state_in("question"))["state"]["question"]
        a.send_json({"type": "answer", "question_id": q["id"], "choice": "không-có"})
        until(a, error("bad_choice"))
        a.send_json({"type": "answer", "question_id": "cau-cu", "choice": right_key(q)})
        until(a, error("bad_phase"))
        host.send_json({"type": "close"})
        until(a, lambda m: m["type"] == "closed")

        # Dò PIN: sai quá MAX_FAILED_JOINS lần trong một phút thì tạm khóa (lần sai đầu tiên đã tính ở trên)
        for _ in range(MAX_FAILED_JOINS - 1):
            other.send_json({"type": "join", "pin": "123"})
            until(other, error("not_found"))
        other.send_json({"type": "join", "pin": "123"})
        until(other, error("too_many"))

    # ------------------------------------------------------------------ hết giờ, mất kết nối
    def test_03_timer_reveal_and_reconnect(self):
        hub.question_seconds = 1.0
        host, _ = self.connect(self.T, "room")
        pin = self.open_room(host)["pin"]
        ws = self.client.websocket_connect("/api/live/ws")
        c = ws.__enter__()
        c.send_json({"type": "auth", "token": self.C})
        recv(c)
        c.send_json({"type": "join", "pin": pin})
        until(c, state_in("lobby"))
        host.send_json({"type": "start"})
        until(c, state_in("question"))
        ws.__exit__(None, None, None)  # học sinh mất mạng giữa câu hỏi
        until(host, lambda m: m["type"] == "room" and m.get("room") and m["room"]["players"] and not m["room"]["players"][0]["connected"])

        again, hello = self.connect(self.C, "state")  # nối lại: tự vào đúng phòng, không cần nhập PIN
        self.assertIsNotNone(hello["state"])
        self.assertEqual(hello["state"]["pin"], pin)
        # Hết giờ: server tự công bố đáp án (có thể đã công bố ngay lúc nối lại nếu máy chạy chậm)
        revealed = hello["state"] if hello["state"]["phase"] == "reveal" else until(again, state_in("reveal"), timeout=4)["state"]
        self.assertIsNone(revealed["me"]["last_correct"])
        self.assertIn("key", revealed["reveal"])

        # Giáo viên tải lại trang: vào lại phòng đang mở
        host2, hello2 = self.connect(self.T, "room")
        self.assertEqual(hello2["room"]["pin"], pin)
        until(host, lambda m: m["type"] == "replaced")
        host2.send_json({"type": "close"})
        until(again, lambda m: m["type"] == "closed")

    def test_04_points_reward_speed_and_streak(self):
        self.assertEqual(points_for(False, 0.1, 3), 0)
        self.assertEqual(points_for(True, 0, 0), 1000)
        self.assertEqual(points_for(True, 20, 0), 500)
        self.assertEqual(points_for(True, 10, 2), 950)
        self.assertEqual(points_for(True, 0, 9), 1500)


if __name__ == "__main__":
    unittest.main()
