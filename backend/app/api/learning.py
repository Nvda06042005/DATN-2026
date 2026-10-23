"""Dữ liệu học tập thật theo tài khoản và game "Hào Khí Đông A".

- /api/student/* : tiến độ, câu hỏi (server chọn và chấm), trạng thái game, Sử Ký, bảng xếp hạng lớp
- /api/teacher/* : lớp học sinh thật của giáo viên phụ trách

Ấn Tín (cột gems) và XP chỉ được cộng ở server khi chấm câu trả lời; client chỉ được tiêu Ấn Tín.
"""
import json
import logging
import random
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.config import ROOT_DIR
from app.core import progress as prog
from app.core.question_bank import question_bank
from database.user_store import store
from bkt_engine import bkt_engine  # module AI trong thư mục ai/

logger = logging.getLogger(__name__)

student_router = APIRouter(prefix="/student", tags=["Student"])
teacher_router = APIRouter(prefix="/teacher", tags=["Teacher"])

MAX_GAME_STATE_CHARS = 16_384
SKIP_CATEGORIES = {"CONVERSATIONAL_INTENT", "CROSS_ERA_SAFEGUARD", "OUT_OF_DOMAIN"}
KB_SOURCE = "SGK Lịch sử và Địa lí 7 & Đại Việt sử ký toàn thư (kho tri thức Đông A)"

# Cụm tri thức bổ sung của game (ngụ binh ư nông, Trần Khánh Dư, ...): BKT chấm và gợi ý ôn tập như các cụm khác
for _uid, _meta in question_bank.units.items():
    bkt_engine.q_matrix.setdefault(_uid, _meta)


def _load_codex() -> list[dict]:
    """Thẻ Sử Ký: lấy từ knowledge_base.json (cùng nguồn với chatbot) + thẻ bổ sung của game."""
    try:
        kb = json.loads((ROOT_DIR / "ai" / "data" / "knowledge_base.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        logger.warning("Không đọc được knowledge_base.json – Sử Ký chỉ có thẻ bổ sung của game")
        kb = {}
    game = {e["unit_id"]: e for e in question_bank.codex if e.get("unit_id")}
    entries = [
        {
            "unit_id": uid,
            "category": u.get("category", ""),
            "topic": u.get("topic", uid),
            "entity": u.get("entity", ""),
            "event": u.get("event", ""),
            "badge": u.get("badge"),
            # Chủ đề bổ sung cùng game đã có trong kho tri thức: giữ nhãn và nguồn trích dẫn riêng của thẻ game
            "label": game.get(uid, {}).get("label", "chinh_su"),
            "fact_chunk": u.get("fact_chunk", ""),
            "answer": u.get("answer", ""),
            "source": game.get(uid, {}).get("source", KB_SOURCE),
        }
        for uid, u in kb.items()
        if u.get("category") not in SKIP_CATEGORIES
    ]
    known = {e["unit_id"] for e in entries}
    entries += [dict(e) for uid, e in game.items() if uid not in known]
    return entries


CODEX = _load_codex()


def _topic(unit_id: str) -> str:
    return (bkt_engine.q_matrix.get(unit_id) or {}).get("topic", unit_id)


def require_role(role: str):
    def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Chức năng này chỉ dành cho {'học sinh' if role == 'student' else 'giáo viên'}")
        return user

    return dep


require_student = require_role("student")
require_teacher = require_role("teacher")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class ProgressOut(BaseModel):
    xp: int
    week_xp: int
    gems: int
    streak: int
    freeze_available: bool
    lessons_completed: int
    perfect_runs: int
    questions_answered: int
    questions_correct: int
    accuracy: Optional[float]
    ai_questions: int
    day_xp: int
    day_lessons: int
    day_correct: int
    day_ai_questions: int
    day_gems: int
    daily_gem_cap: int
    class_name: Optional[str]
    class_rank: int
    class_size: int


class GameStateIn(BaseModel):
    state: dict


class GameStateOut(BaseModel):
    state: Optional[dict]
    updated_at: Optional[str]


class ServedOption(BaseModel):
    key: Union[int, str]
    text: str


class ServedQuestion(BaseModel):
    id: str
    unit_id: str
    type: str
    prompt: str
    level: str
    topic: str
    source: Optional[str] = None
    hint: Optional[str] = None
    options: Optional[list[ServedOption]] = None
    items: Optional[list[ServedOption]] = None
    left: Optional[list[ServedOption]] = None
    right: Optional[list[ServedOption]] = None


class QuestionsOut(BaseModel):
    questions: list[ServedQuestion]
    mode: str
    units: list[str]
    note: Optional[str] = None


class AiQuestionsIn(BaseModel):
    unit_id: Optional[str] = Field(None, pattern=r"^[A-Z0-9_]{1,64}$")
    count: int = Field(3, ge=1, le=5)


class AnswerIn(BaseModel):
    question_id: str = Field(..., pattern=r"^[A-Za-z0-9_\-]{1,64}$")
    choice: Optional[Union[bool, int, str]] = None
    order: Optional[list[int]] = Field(None, max_length=10)
    pairs: Optional[dict[str, int]] = None


class AnswerOut(BaseModel):
    question_id: str
    unit_id: str
    topic: str
    correct: bool
    reveal: dict
    explanation: str
    source: Optional[str]
    old_p_l: float
    new_p_l: float
    p_l_delta: float
    mastery_status: str
    attempts: int
    xp_gained: int
    gems_gained: int
    progress: ProgressOut


class QuizCompleteRequest(BaseModel):
    correct: int = Field(..., ge=0, le=50)
    total: int = Field(..., ge=1, le=50)


class QuizCompleteResponse(BaseModel):
    lessons_completed: int
    perfect: bool
    progress: ProgressOut


class GemsRequest(BaseModel):
    delta: int = Field(..., ge=-100_000, le=-1, description="Chỉ được tiêu Ấn Tín (số âm)")
    reason: str = Field("", max_length=80)


class LeaderboardEntry(BaseModel):
    id: int
    full_name: str
    xp: int
    week_xp: int
    streak: int
    is_me: bool


class CodexEntry(BaseModel):
    unit_id: str
    category: str
    topic: str
    entity: str
    event: str
    badge: Optional[str]
    label: str
    fact_chunk: str
    answer: str
    source: Optional[str]


class RosterStudent(BaseModel):
    id: int
    full_name: str
    username: str
    is_active: bool
    must_change_password: bool
    last_login_at: Optional[str]
    xp: int
    week_xp: int
    streak: int
    lessons_completed: int
    perfect_runs: int
    questions_answered: int
    accuracy: Optional[float]
    avg_mastery: Optional[float]
    ai_questions: int
    campaign_stars: list[int]
    stars: int
    heroes: int


class ClassSummary(BaseModel):
    total: int
    active_7d: int
    practiced: int
    avg_accuracy: Optional[float]
    best_streak: int
    total_stars: int
    avg_mastery: Optional[float]


class WrongQuestion(BaseModel):
    question_id: str
    prompt: str
    unit_id: str
    topic: str
    attempts: int
    wrong: int
    students: int


class UnitMastery(BaseModel):
    unit_id: str
    topic: str
    avg_p_l: float
    students: int


class SupportNeed(BaseModel):
    id: int
    full_name: str
    reasons: list[str]


class TeacherClassOut(BaseModel):
    class_name: Optional[str]
    students: list[RosterStudent]
    summary: ClassSummary
    top_wrong: list[WrongQuestion]
    unit_mastery: list[UnitMastery]
    needs_support: list[SupportNeed]


# ---------------------------------------------------------------------------
# Tiện ích
# ---------------------------------------------------------------------------
def _engine_id(user: dict) -> str:
    return f"user_{user['id']}"


def _restore_bkt(user: dict, p: dict) -> str:
    """Nạp trạng thái BKT đã lưu của học sinh vào bộ máy (nếu chưa có trong RAM)."""
    sid = _engine_id(user)
    if sid not in bkt_engine.student_states:
        bkt_engine.student_states[sid] = prog.load_json(p.get("bkt_state"))
    return sid


def _ranking(user: dict) -> tuple[int, int]:
    classmates = store.students_in_class(user.get("class_name")) or [user]
    progress = store.all_progress(light=True)
    ranked = sorted(classmates, key=lambda u: (-int((progress.get(u["id"]) or {}).get("xp") or 0), u["full_name"]))
    rank = next((i + 1 for i, u in enumerate(ranked) if u["id"] == user["id"]), 1)
    return rank, len(ranked)


def _out(user: dict, p: dict) -> ProgressOut:
    prog.roll_day(p)
    rank, size = _ranking(user)
    return ProgressOut(
        xp=int(p["xp"]),
        week_xp=int(p.get("week_xp") or 0),
        gems=int(p["gems"]),
        streak=prog.effective_streak(p),
        freeze_available=prog.freeze_available(p),
        lessons_completed=int(p["lessons_completed"]),
        perfect_runs=int(p["perfect_runs"]),
        questions_answered=int(p["questions_answered"]),
        questions_correct=int(p["questions_correct"]),
        accuracy=prog.accuracy(p),
        ai_questions=int(p["ai_questions"]),
        day_xp=int(p["day_xp"]),
        day_lessons=int(p["day_lessons"]),
        day_correct=int(p["day_correct"]),
        day_ai_questions=int(p["day_ai_questions"]),
        day_gems=int(p.get("day_gems") or 0),
        daily_gem_cap=prog.DAILY_GEM_CAP,
        class_name=user.get("class_name"),
        class_rank=rank,
        class_size=size,
    )


def _save(user_id: int, p: dict) -> dict:
    """Ghi các bộ đếm do server quản lý. game_state chỉ ghi qua PUT /student/game để không đè bản client vừa lưu."""
    return store.save_progress(user_id, {k: v for k, v in p.items() if k != "game_state"})


def record_answer(user: dict, q: dict, correct: bool) -> tuple[dict, int, int, dict]:
    """Ghi một câu trả lời server đã chấm (BKT, XP, Ấn Tín, thống kê câu, chuỗi ngày) – dùng cho luyện tập và thi đấu lớp."""
    p = prog.roll_day(store.get_progress(user["id"]))
    sid = _restore_bkt(user, p)
    before = (bkt_engine.student_states.get(sid) or {}).get(q["unit_id"]) or {}
    weak = bool(before.get("attempts")) and float(before.get("p_l", 0.3)) < prog.WEAK_THRESHOLD
    result = bkt_engine.update_student_response(student_id=sid, unit_id=q["unit_id"], is_correct=correct)

    p["questions_answered"] = int(p["questions_answered"]) + 1
    if correct:
        p["questions_correct"] = int(p["questions_correct"]) + 1
        p["day_correct"] = int(p["day_correct"]) + 1
    xp, gems = prog.award_answer(p, correct=correct, weak=weak)
    prog.touch_streak(p)

    if not q.get("ai"):
        stats = prog.load_json(p.get("question_stats"))
        attempts, wrong = (stats.get(q["id"]) or [0, 0])[:2]
        stats[q["id"]] = [int(attempts) + 1, int(wrong) + (0 if correct else 1)]
        p["question_stats"] = json.dumps(stats, separators=(",", ":"))
    p["bkt_state"] = json.dumps(bkt_engine.student_states[sid], ensure_ascii=False)
    return result, xp, gems, _save(user["id"], p)


def record_session(user: dict, correct: int, total: int) -> tuple[dict, bool]:
    """Ghi nhận hoàn thành một lượt học/trận đánh/trận thi đấu lớp."""
    p = prog.roll_day(store.get_progress(user["id"]))
    p["lessons_completed"] = int(p["lessons_completed"]) + 1
    p["day_lessons"] = int(p["day_lessons"]) + 1
    perfect = total > 0 and correct == total
    if perfect:
        p["perfect_runs"] = int(p["perfect_runs"]) + 1
    prog.touch_streak(p)
    return _save(user["id"], p), perfect


def _split_csv(value: Optional[str], limit: int = 40) -> list[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()][:limit]


def _weak_units(sid: str, limit: int = 3) -> list[str]:
    """Cụm tri thức học sinh đã làm nhưng còn yếu (P(L) < 0.6); chưa có thì lấy cụm chưa làm."""
    state = bkt_engine.student_states.get(sid, {})
    units = question_bank.units_with_questions()
    tried = sorted(
        (float(r.get("p_l", 0.3)), uid)
        for uid in units
        if isinstance(r := state.get(uid), dict) and r.get("attempts") and float(r.get("p_l", 0.3)) < prog.WEAK_THRESHOLD
    )
    if tried:
        return [uid for _, uid in tried[:limit]]
    untried = [uid for uid in units if not (state.get(uid) or {}).get("attempts")]
    random.shuffle(untried)
    return untried[:limit] or units[:limit]


# ---------------------------------------------------------------------------
# /api/student – tiến độ & trạng thái game
# ---------------------------------------------------------------------------
@student_router.get("/progress", response_model=ProgressOut)
def get_progress(user: dict = Depends(require_student)):
    return _out(user, store.get_progress(user["id"]))


@student_router.get("/game", response_model=GameStateOut)
def get_game(user: dict = Depends(require_student)):
    p = store.get_progress(user["id"])
    return GameStateOut(state=prog.load_json(p.get("game_state")) or None, updated_at=p.get("updated_at"))


@student_router.put("/game", response_model=GameStateOut)
def save_game(body: GameStateIn, user: dict = Depends(require_student)):
    text = json.dumps(body.state, ensure_ascii=False, separators=(",", ":"))
    if len(text) > MAX_GAME_STATE_CHARS:
        raise HTTPException(413, "Dữ liệu game quá lớn (tối đa 16 KB)")
    p = store.save_progress(user["id"], {"game_state": text})
    return GameStateOut(state=body.state, updated_at=p.get("updated_at"))


# ---------------------------------------------------------------------------
# /api/student – câu hỏi (server giữ đáp án và chấm)
# ---------------------------------------------------------------------------
@student_router.get("/questions", response_model=QuestionsOut)
def get_questions(
    units: Optional[str] = Query(None, description="Danh sách unit_id, cách nhau bởi dấu phẩy"),
    count: int = Query(5, ge=1, le=15),
    mode: str = Query("mixed", pattern="^(mixed|weak)$"),
    exclude: Optional[str] = Query(None, description="Mã câu đã gặp trong phiên"),
    types: Optional[str] = Query(None, description="Lọc dạng câu: mcq,tf,order,match,map"),
    levels: Optional[str] = Query(None, description="Lọc mức độ: NHAN_BIET,THONG_HIEU,VAN_DUNG"),
    user: dict = Depends(require_student),
):
    wanted = [u for u in _split_csv(units) if u in question_bank.by_unit]
    note = None
    if mode == "weak":
        sid = _restore_bkt(user, store.get_progress(user["id"]))
        wanted = _weak_units(sid)
        note = "Câu hỏi thuộc các cụm tri thức em cần củng cố"
    picked = question_bank.pick(
        wanted or None, count, set(_split_csv(exclude, 200)), set(_split_csv(types)) or None, levels=set(_split_csv(levels)) or None
    )
    return QuestionsOut(
        questions=[ServedQuestion(**question_bank.serve(q, topic=_topic(q["unit_id"]))) for q in picked],
        mode=mode,
        units=wanted,
        note=note,
    )


@student_router.post("/questions/ai", response_model=QuestionsOut)
async def ai_questions(body: AiQuestionsIn, user: dict = Depends(require_student)):
    """Câu hỏi do AI sinh từ kho tri thức (RAG); hết quota/không có khóa AI thì dùng ngân hàng câu hỏi."""
    from gemini_client import gemini_client
    from rag_engine import rag_engine

    unit_id = body.unit_id if body.unit_id in question_bank.by_unit else None
    if unit_id is None:
        sid = _restore_bkt(user, store.get_progress(user["id"]))
        unit_id = _weak_units(sid, limit=1)[0]
    topic = _topic(unit_id)
    served: list[dict] = []
    try:
        records = rag_engine.search_relevant_chunks(query=topic, top_k=5)
        generated = await gemini_client.generate_quiz(
            topic=topic, num_questions=body.count, cognitive_level="Tất cả mức độ", grounding_records=records
        )
        # Bỏ câu dự phòng cố định của gemini_client (không thuộc chủ đề đang hỏi) để BKT không ghi sai cụm tri thức
        for g in [g for g in generated if not str(g.id).startswith("q-fallback")][: body.count]:
            q = question_bank.remember_ai(
                unit_id, g.question, list(g.options), g.correct_index, g.explanation,
                f"Quân Sư AI – {g.curriculum_reference}",
            )
            if q:
                served.append(question_bank.serve(q, topic=topic))
    except Exception:  # AI không sẵn sàng: dùng câu trong ngân hàng
        logger.warning("Không sinh được câu hỏi AI cho %s", unit_id)
    note = None
    if not served:
        note = "Quân Sư AI đang bận – dùng câu hỏi trong ngân hàng của game"
        served = [question_bank.serve(q, topic=topic) for q in question_bank.pick([unit_id], body.count, set())]
    return QuestionsOut(questions=[ServedQuestion(**s) for s in served], mode="ai", units=[unit_id], note=note)


@student_router.post("/answer", response_model=AnswerOut)
def submit_answer(body: AnswerIn, user: dict = Depends(require_student)):
    q = question_bank.get(body.question_id)
    if q is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Câu hỏi không tồn tại hoặc đã hết hạn")
    correct, reveal = question_bank.grade(q, choice=body.choice, order=body.order, pairs=body.pairs)
    result, xp, gems, p = record_answer(user, q, correct)
    return AnswerOut(
        question_id=q["id"],
        unit_id=q["unit_id"],
        topic=result.get("topic") or _topic(q["unit_id"]),
        correct=correct,
        reveal=reveal,
        explanation=q["explanation"],
        source=q.get("source"),
        old_p_l=result["old_p_l"],
        new_p_l=result["new_p_l"],
        p_l_delta=result["p_l_delta"],
        mastery_status=result["mastery_status"],
        attempts=result["attempts"],
        xp_gained=xp,
        gems_gained=gems,
        progress=_out(user, p),
    )


@student_router.post("/quiz-complete", response_model=QuizCompleteResponse)
def quiz_complete(body: QuizCompleteRequest, user: dict = Depends(require_student)):
    """Ghi nhận hoàn thành một lượt học/trận đánh. XP, Ấn Tín đã được cộng theo từng câu ở /answer."""
    if body.correct > body.total:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Số câu đúng không thể lớn hơn tổng số câu")
    p = prog.roll_day(store.get_progress(user["id"]))
    if body.correct > int(p["day_correct"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Số câu đúng chưa khớp với các câu server đã chấm hôm nay")
    p, perfect = record_session(user, body.correct, body.total)
    return QuizCompleteResponse(lessons_completed=int(p["lessons_completed"]), perfect=perfect, progress=_out(user, p))


@student_router.post("/ai-question", response_model=ProgressOut)
def ai_question(user: dict = Depends(require_student)):
    p = prog.roll_day(store.get_progress(user["id"]))
    p["ai_questions"] = int(p["ai_questions"]) + 1
    p["day_ai_questions"] = int(p["day_ai_questions"]) + 1
    prog.touch_streak(p)
    return _out(user, _save(user["id"], p))


@student_router.post("/gems", response_model=ProgressOut)
def spend_gems(body: GemsRequest, user: dict = Depends(require_student)):
    """Tiêu Ấn Tín (chiêu mộ, tiến hóa, nâng cấp). Ấn Tín chỉ được cộng khi server chấm câu trả lời đúng."""
    p = store.get_progress(user["id"])
    new_value = int(p["gems"]) + body.delta
    if new_value < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không đủ Ấn Tín")
    p["gems"] = new_value
    return _out(user, _save(user["id"], p))


@student_router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(user: dict = Depends(require_student)):
    classmates = store.students_in_class(user.get("class_name")) or [user]
    progress = store.all_progress(light=True)
    week = prog.week_key()
    entries = []
    for u in classmates:
        if not (u["is_active"] or u["id"] == user["id"]):
            continue
        p = progress.get(u["id"]) or {}
        entries.append(
            LeaderboardEntry(
                id=u["id"],
                full_name=u["full_name"],
                xp=int(p.get("xp") or 0),
                week_xp=int(p.get("week_xp") or 0) if p.get("week_key") == week else 0,
                streak=prog.effective_streak(p or None),
                is_me=u["id"] == user["id"],
            )
        )
    entries.sort(key=lambda e: (-e.week_xp, -e.xp, e.full_name))
    return entries


@student_router.get("/recommendations")
def recommendations(top_k: int = Query(5, ge=1, le=10), user: dict = Depends(require_student)):
    p = store.get_progress(user["id"])
    sid = _restore_bkt(user, p)
    recs = bkt_engine.recommend_personalized_review(student_id=sid, top_k=top_k)
    return {"recommendations": recs, "total_recommendations": len(recs)}


@student_router.get("/codex", response_model=list[CodexEntry])
def codex(_: dict = Depends(require_student)):
    return CODEX


# ---------------------------------------------------------------------------
# /api/teacher
# ---------------------------------------------------------------------------
@teacher_router.get("/class", response_model=TeacherClassOut)
def my_class(user: dict = Depends(require_teacher)):
    students = store.students_in_class(user.get("class_name"))
    progress = store.all_progress()
    week = prog.week_key()
    roster: list[RosterStudent] = []
    wrong_totals: dict[str, list[int]] = {}
    unit_scores: dict[str, list[float]] = {}
    for s in students:
        p = progress.get(s["id"])
        camp = prog.campaign_stars(p)
        roster.append(
            RosterStudent(
                id=s["id"],
                full_name=s["full_name"],
                username=s["username"],
                is_active=s["is_active"],
                must_change_password=s["must_change_password"],
                last_login_at=s["last_login_at"],
                xp=int((p or {}).get("xp") or 0),
                week_xp=int((p or {}).get("week_xp") or 0) if (p or {}).get("week_key") == week else 0,
                streak=prog.effective_streak(p),
                lessons_completed=int((p or {}).get("lessons_completed") or 0),
                perfect_runs=int((p or {}).get("perfect_runs") or 0),
                questions_answered=int((p or {}).get("questions_answered") or 0),
                accuracy=prog.accuracy(p),
                avg_mastery=prog.avg_mastery(p),
                ai_questions=int((p or {}).get("ai_questions") or 0),
                campaign_stars=camp,
                stars=sum(camp),
                heroes=prog.hero_count(p),
            )
        )
        for qid, row in prog.load_json((p or {}).get("question_stats")).items():
            if isinstance(row, list) and len(row) >= 2 and qid in question_bank.questions:
                total = wrong_totals.setdefault(qid, [0, 0, 0])
                total[0] += int(row[0])
                total[1] += int(row[1])
                total[2] += 1 if int(row[1]) else 0
        for uid, rec in prog.load_json((p or {}).get("bkt_state")).items():
            if isinstance(rec, dict) and rec.get("attempts"):
                unit_scores.setdefault(uid, []).append(float(rec.get("p_l", 0)))

    roster.sort(key=lambda r: (-r.xp, r.full_name))
    accs = [r.accuracy for r in roster if r.accuracy is not None]
    masteries = [r.avg_mastery for r in roster if r.avg_mastery is not None]
    summary = ClassSummary(
        total=len(roster),
        active_7d=sum(1 for r in roster if prog.active_within(r.last_login_at, 7)),
        practiced=sum(1 for r in roster if r.questions_answered > 0),
        avg_accuracy=round(sum(accs) / len(accs), 3) if accs else None,
        best_streak=max((r.streak for r in roster), default=0),
        total_stars=sum(r.stars for r in roster),
        avg_mastery=round(sum(masteries) / len(masteries), 3) if masteries else None,
    )
    top_wrong = [
        WrongQuestion(
            question_id=qid,
            prompt=question_bank.questions[qid]["prompt"],
            unit_id=question_bank.questions[qid]["unit_id"],
            topic=_topic(question_bank.questions[qid]["unit_id"]),
            attempts=t[0],
            wrong=t[1],
            students=t[2],
        )
        for qid, t in sorted(wrong_totals.items(), key=lambda kv: (-kv[1][1], -kv[1][2], kv[0]))
        if t[1] > 0
    ][:5]
    unit_mastery = sorted(
        (
            UnitMastery(unit_id=uid, topic=_topic(uid), avg_p_l=round(sum(v) / len(v), 3), students=len(v))
            for uid, v in unit_scores.items()
            if (bkt_engine.q_matrix.get(uid) or {}).get("category") not in SKIP_CATEGORIES
        ),
        key=lambda m: m.avg_p_l,
    )
    needs_support = []
    for r in roster:
        reasons = []
        if not prog.active_within(r.last_login_at, 7):
            reasons.append("Chưa vào học 7 ngày qua")
        if r.accuracy is not None and r.questions_answered >= 5 and r.accuracy < 0.5:
            reasons.append(f"Trả lời đúng {round(r.accuracy * 100)}%")
        if r.avg_mastery is not None and r.avg_mastery < 0.4:
            reasons.append(f"Mức nắm vững trung bình {round(r.avg_mastery * 100)}%")
        if reasons:
            needs_support.append(SupportNeed(id=r.id, full_name=r.full_name, reasons=reasons))
    return TeacherClassOut(
        class_name=user.get("class_name"),
        students=roster,
        summary=summary,
        top_wrong=top_wrong,
        unit_mastery=unit_mastery,
        needs_support=needs_support,
    )
