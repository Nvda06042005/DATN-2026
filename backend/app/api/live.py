"""Thi đấu cả lớp theo thời gian thực.

- WS  /api/live/ws                 : phòng thi đấu (giáo viên mở phòng, học sinh vào bằng PIN) – xem app/core/live.py
- GET /api/teacher/live-sessions   : lịch sử các trận đã chơi của giáo viên

Kết nối WebSocket gửi token đăng nhập trong tin nhắn đầu tiên {"type": "auth", "token": ...}
(không đặt token trên URL để token không xuất hiện trong log truy cập của máy chủ).
"""
import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.api.learning import _topic, record_answer, record_session, require_teacher
from app.core.live import ERRORS, Conn, hub
from app.core.question_bank import question_bank
from app.core.security import decode_token, password_fingerprint
from bkt_engine import bkt_engine  # module AI trong thư mục ai/
from database.user_store import store

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Live"])

AUTH_TIMEOUT_SECONDS = 10
MAX_MESSAGE_CHARS = 4096

# Phạm vi câu hỏi giáo viên chọn khi mở phòng (theo nhóm cụm tri thức của bài học)
SCOPE_CATEGORIES = {
    "1258": {"KHANG_CHIEN_LAN_1_1258"},
    "1285": {"BINH_THAN_TRAN_QUOC_TOAN", "DIEN_HONG_HICH_TUONG_SI", "KHANG_CHIEN_LAN_2_1285"},
    "1288": {"HAI_CHIEN_VAN_DON_1288", "DAI_THANG_BACH_DANG_1288"},
}
SCOPE_EXTRA_UNITS = {"1288": {"GAME_TRAN_KHANH_DU"}}


def _scopes() -> dict[str, Optional[list[str]]]:
    units = question_bank.units_with_questions()
    scopes: dict[str, Optional[list[str]]] = {"all": None}
    for key, categories in SCOPE_CATEGORIES.items():
        scopes[key] = [
            u for u in units
            if (bkt_engine.q_matrix.get(u) or {}).get("category") in categories or u in SCOPE_EXTRA_UNITS.get(key, set())
        ]
    return scopes


def _save_session(session: dict, results: list[dict]) -> int:
    return store.save_live_session(session, results)


hub.scopes = _scopes()
hub.topic_of = _topic
hub.record_answer = record_answer
hub.record_player = record_session
hub.save_session = _save_session


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
def _user_from_token(token: str) -> Optional[dict]:
    if not store.ready:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user = store.get_by_id(int(payload["sub"]))
    if not user or not user["is_active"] or payload.get("pfp") != password_fingerprint(user["password_hash"]):
        return None
    return {k: user[k] for k in ("id", "username", "full_name", "role", "class_name")}


async def _reject(ws: WebSocket, code: str, close_code: int) -> None:
    try:
        await ws.send_text(json.dumps({"type": "error", "code": code, "message": ERRORS[code]}, ensure_ascii=False))
        await ws.close(code=close_code)
    except Exception:
        pass


async def _authenticate(ws: WebSocket) -> Optional[dict]:
    try:
        message = await asyncio.wait_for(ws.receive(), timeout=AUTH_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        await _reject(ws, "auth", 4401)
        return None
    if message["type"] == "websocket.disconnect":
        return None
    try:
        data = json.loads(message.get("text") or "")
    except ValueError:
        data = None
    token = data.get("token") if isinstance(data, dict) and data.get("type") == "auth" else None
    user = await asyncio.to_thread(_user_from_token, token) if isinstance(token, str) and len(token) < 2048 else None
    if user is None:
        await _reject(ws, "auth", 4401)
        return None
    if user["role"] not in ("teacher", "student"):
        await _reject(ws, "role", 4403)
        return None
    return user


@router.websocket("/live/ws")
async def live_socket(ws: WebSocket):
    await ws.accept()
    user = await _authenticate(ws)
    if user is None:
        return
    conn = Conn(ws, user)
    hub.attach(conn)
    try:
        while not conn.closed:
            message = await ws.receive()
            if message["type"] == "websocket.disconnect":
                break
            text = message.get("text")
            if not text or len(text) > MAX_MESSAGE_CHARS:
                continue
            try:
                msg = json.loads(text)
            except ValueError:
                continue
            if isinstance(msg, dict):
                hub.handle(conn, msg)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        hub.detach(conn)
        conn.close()
        await conn.drain()


# ---------------------------------------------------------------------------
# Lịch sử trận của giáo viên
# ---------------------------------------------------------------------------
class LiveResultOut(BaseModel):
    user_id: int
    full_name: str
    rank: int
    score: int
    correct: int
    answered: int


class LiveQuestionOut(BaseModel):
    question_id: str
    prompt: str
    topic: str
    answered: int
    correct: int


class LiveSessionOut(BaseModel):
    id: int
    title: str
    scope: str
    class_name: Optional[str]
    question_count: int
    player_count: int
    started_at: str
    finished_at: str
    accuracy: Optional[float]
    results: list[LiveResultOut]
    questions: list[LiveQuestionOut]


@router.get("/teacher/live-sessions", response_model=list[LiveSessionOut])
def live_sessions(limit: int = Query(10, ge=1, le=50), user: dict = Depends(require_teacher)):
    out = []
    for s in store.live_sessions_for_teacher(user["id"], limit):
        try:
            rows = json.loads(s.get("question_stats") or "[]")
        except ValueError:
            rows = []
        questions = []
        for row in rows if isinstance(rows, list) else []:
            q = question_bank.questions.get(row.get("id")) if isinstance(row, dict) else None
            if q:
                questions.append(
                    LiveQuestionOut(
                        question_id=q["id"], prompt=q["prompt"], topic=_topic(q["unit_id"]),
                        answered=int(row.get("answered") or 0), correct=int(row.get("correct") or 0),
                    )
                )
        answered = sum(q.answered for q in questions)
        out.append(
            LiveSessionOut(
                id=s["id"],
                title=s["title"],
                scope=s["scope"],
                class_name=s.get("class_name"),
                question_count=int(s["question_count"]),
                player_count=int(s["player_count"]),
                started_at=s["started_at"],
                finished_at=s["finished_at"],
                accuracy=round(sum(q.correct for q in questions) / answered, 3) if answered else None,
                results=[LiveResultOut(**{k: r[k] for k in LiveResultOut.model_fields}) for r in s["results"]],
                questions=questions,
            )
        )
    return out
