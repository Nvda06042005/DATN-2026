"""Thi đấu cả lớp theo thời gian thực (kiểu Kahoot) qua WebSocket.

- Giáo viên mở phòng; server sinh mã PIN 6 chữ số và chọn câu trong ngân hàng của game
  (chỉ dạng trắc nghiệm và đúng/sai, để học sinh bấm nhanh trên điện thoại).
- Học sinh cùng lớp vào phòng bằng PIN. Server giữ đáp án, chấm từng câu và tính điểm theo tốc độ;
  đáp án chỉ được gửi xuống khi hết giờ hoặc cả lớp đã trả lời.
- Mỗi câu trả lời được ghi vào tiến độ thật (BKT, XP, Ấn Tín) như khi luyện tập; trận kết thúc được lưu lịch sử.

Trạng thái phòng nằm trong bộ nhớ của tiến trình backend, nên backend phải chạy MỘT tiến trình
(như cấu hình hiện tại). Mất kết nối thì client tự nối lại và được gắn lại vào phòng đang chơi.
Mọi hàm của LiveHub chạy trên vòng lặp sự kiện và không chặn; ghi cơ sở dữ liệu đi qua luồng phụ.
"""
import asyncio
import json
import logging
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from app.core.question_bank import question_bank

logger = logging.getLogger(__name__)

QUESTION_SECONDS = 20
QUESTION_COUNTS = (5, 10, 15)
DEFAULT_TITLE = "Thi đấu Lịch sử 7"
MAX_TITLE_CHARS = 120
MAX_PLAYERS = 80
MAX_ROOMS = 300
MAX_FAILED_JOINS = 8                 # nhập sai PIN quá số lần này trong 1 phút thì tạm khóa
FAILED_JOIN_WINDOW = 60
ANSWER_GRACE_SECONDS = 1.0           # bù độ trễ mạng khi bấm sát giờ
HOST_GRACE_SECONDS = 15 * 60         # giáo viên rời phòng quá lâu thì đóng phòng
ROOM_MAX_SECONDS = 4 * 3600
LIVE_TYPES = {"mcq", "tf"}
TF_OPTIONS = [{"key": True, "text": "Đúng"}, {"key": False, "text": "Sai"}]

ERRORS = {
    "auth": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
    "role": "Phòng thi đấu chỉ dành cho giáo viên và học sinh",
    "no_class": "Tài khoản chưa được gán lớp – nhờ quản trị viên cập nhật",
    "busy": "Máy chủ đang có quá nhiều phòng thi đấu, thử lại sau ít phút",
    "no_questions": "Chưa có câu hỏi phù hợp cho phạm vi này",
    "no_room": "Chưa có phòng thi đấu nào đang mở",
    "not_found": "Không tìm thấy phòng của lớp em với mã PIN này",
    "banned": "Em đã được mời ra khỏi phòng này",
    "locked": "Phòng đã khóa, không nhận thêm người chơi",
    "full": "Phòng đã đủ người chơi",
    "no_players": "Chờ ít nhất một học sinh vào phòng",
    "bad_phase": "Thao tác không hợp lệ ở bước này",
    "bad_choice": "Lựa chọn không hợp lệ",
    "time_up": "Đã hết giờ trả lời câu này",
    "too_many": "Nhập sai mã PIN quá nhiều lần – chờ 1 phút rồi thử lại",
    "bad_request": "Yêu cầu không hợp lệ",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def points_for(correct: bool, elapsed: float, streak: int, duration: float = QUESTION_SECONDS) -> int:
    """Đúng ngay lập tức được 1000 điểm, sát giờ còn 500; thêm 100 cho mỗi câu đúng liên tiếp trước đó (tối đa 500)."""
    if not correct:
        return 0
    ratio = min(max(elapsed, 0.0), duration) / duration
    return round(1000 * (1 - ratio / 2)) + min(streak, 5) * 100


def same_key(a: Any, b: Any) -> bool:
    """So khớp khóa lựa chọn kể cả kiểu dữ liệu (true khác 1)."""
    return type(a) is type(b) and a == b


class Conn:
    """Một kết nối WebSocket đã đăng nhập; tin nhắn đi qua hàng đợi riêng để không chặn vòng lặp sự kiện."""

    def __init__(self, ws: Any, user: dict) -> None:
        self.ws = ws
        self.user = user
        self.closed = False
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._writer = asyncio.get_running_loop().create_task(self._write())

    @property
    def alive(self) -> bool:
        return not self.closed

    def send(self, msg: dict) -> None:
        if self.closed:
            return
        try:
            self._queue.put_nowait(json.dumps(msg, ensure_ascii=False, separators=(",", ":")))
        except asyncio.QueueFull:  # máy quá chậm: ngắt để client tự nối lại và nhận trạng thái mới nhất
            self.close(1013)

    def close(self, code: int = 1000) -> None:
        if self.closed:
            return
        self.closed = True
        try:
            self._queue.put_nowait(code)
        except asyncio.QueueFull:
            self._writer.cancel()

    async def drain(self, timeout: float = 2.0) -> None:
        try:
            await asyncio.wait_for(asyncio.shield(self._writer), timeout)
        except (asyncio.TimeoutError, asyncio.CancelledError, Exception):
            self._writer.cancel()

    async def _write(self) -> None:
        try:
            while True:
                item = await self._queue.get()
                if isinstance(item, int):
                    await self.ws.close(code=item)
                    break
                await self.ws.send_text(item)
        except Exception:  # client đã ngắt kết nối
            pass
        finally:
            self.closed = True


@dataclass
class Player:
    id: int
    name: str
    user: dict
    conn: Optional[Conn] = None
    score: int = 0
    streak: int = 0
    correct: int = 0
    answered: int = 0
    last_gain: int = 0
    last_correct: Optional[bool] = None
    current: Optional[dict] = None  # câu trả lời cho câu đang hỏi: {"key", "correct", "gain"}

    @property
    def online(self) -> bool:
        return self.conn is not None and self.conn.alive


@dataclass
class Room:
    pin: str
    host_id: int
    class_name: str
    title: str
    scope: str
    questions: list
    served: list
    host: Optional[Conn] = None
    phase: str = "lobby"  # lobby | question | reveal | scoreboard | podium
    index: int = -1
    locked: bool = False
    players: dict = field(default_factory=dict)
    banned: set = field(default_factory=set)
    stats: list = field(default_factory=list)
    q_started: float = 0.0
    deadline: float = 0.0
    timer: Optional[asyncio.Task] = None
    created: float = field(default_factory=time.monotonic)
    host_left: Optional[float] = None
    started_at: Optional[str] = None
    saved: bool = False
    session_id: Optional[int] = None


class LiveHub:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.by_host: dict[int, str] = {}
        self.by_player: dict[int, str] = {}
        self.question_seconds: float = QUESTION_SECONDS
        # Tầng API gắn vào: phạm vi câu hỏi, tên chủ đề, ghi tiến độ và lưu trận (chạy ở luồng phụ)
        self.scopes: dict[str, Optional[list]] = {"all": None}
        self.topic_of: Callable[[str], str] = lambda unit_id: unit_id
        self.record_answer: Optional[Callable[[dict, dict, bool], Any]] = None
        self.record_player: Optional[Callable[[dict, int, int], Any]] = None
        self.save_session: Optional[Callable[[dict, list], Optional[int]]] = None
        self._jobs: set[asyncio.Task] = set()
        self._tails: dict[int, asyncio.Task] = {}
        self._failed_joins: dict[int, tuple[int, float]] = {}

    # ------------------------------------------------------------------ kết nối
    def attach(self, conn: Conn) -> None:
        """Gắn kết nối vừa đăng nhập; nếu đang ở trong một phòng thì vào lại đúng phòng đó."""
        self._purge()
        uid = conn.user["id"]
        if conn.user["role"] == "teacher":
            room = self._room_of_host(uid)
            if room:
                if room.host and room.host is not conn:
                    room.host.send({"type": "replaced"})
                    room.host.close(4000)
                room.host = conn
                room.host_left = None
                self._broadcast(room)
            else:
                conn.send({"type": "room", "room": None})
            return
        room = self._room_of_player(uid)
        if not room:
            conn.send({"type": "state", "state": None})
            return
        player = room.players[uid]
        if player.conn and player.conn is not conn:
            player.conn.send({"type": "replaced"})
            player.conn.close(4000)
        player.conn = conn
        self._send_player(room, player)
        self._send_host(room)

    def detach(self, conn: Conn) -> None:
        uid = conn.user["id"]
        if conn.user["role"] == "teacher":
            room = self._room_of_host(uid)
            if room and room.host is conn:
                room.host = None
                room.host_left = time.monotonic()
                for p in room.players.values():
                    self._send_player(room, p)
            return
        room = self._room_of_player(uid)
        if room and room.players[uid].conn is conn:
            room.players[uid].conn = None
            self._send_host(room)
            self._reveal_if_all_answered(room)

    def handle(self, conn: Conn, msg: dict) -> None:
        kind = msg.get("type")
        if kind == "ping":
            conn.send({"type": "pong"})
            return
        role = conn.user["role"]
        handler = None
        if role == "teacher" and kind in ("create", "lock", "kick", "start", "reveal", "next", "close"):
            handler = getattr(self, f"_host_{kind}")
        elif role == "student" and kind in ("join", "answer", "leave"):
            handler = getattr(self, f"_player_{kind}")
        if handler is None:
            self._error(conn, "bad_request")
            return
        handler(conn, msg)

    # ------------------------------------------------------------------ giáo viên
    def _host_create(self, conn: Conn, msg: dict) -> None:
        user = conn.user
        if not user.get("class_name"):
            self._error(conn, "no_class")
            return
        old = self._room_of_host(user["id"])
        if old:
            self._close(old, "replaced")
        self._purge()
        if len(self.rooms) >= MAX_ROOMS:
            self._error(conn, "busy")
            return
        scope = msg.get("scope") if msg.get("scope") in self.scopes else "all"
        count = msg.get("count") if msg.get("count") in QUESTION_COUNTS else 10
        title = " ".join(str(msg.get("title") or "").split())[:MAX_TITLE_CHARS] or DEFAULT_TITLE
        picked = [q for q in question_bank.pick(self.scopes[scope], count, set(), LIVE_TYPES) if q["type"] in LIVE_TYPES]
        if not picked:
            self._error(conn, "no_questions")
            return
        room = Room(
            pin=self._new_pin(),
            host_id=user["id"],
            class_name=user["class_name"],
            title=title,
            scope=scope,
            questions=picked,
            served=[self._serve(q) for q in picked],
            host=conn,
        )
        self.rooms[room.pin] = room
        self.by_host[user["id"]] = room.pin
        self._send_host(room)

    def _host_room(self, conn: Conn) -> Optional[Room]:
        room = self._room_of_host(conn.user["id"])
        if room is None or room.host is not conn:
            self._error(conn, "no_room")
            return None
        return room

    def _host_lock(self, conn: Conn, msg: dict) -> None:
        room = self._host_room(conn)
        if room:
            room.locked = bool(msg.get("locked"))
            self._send_host(room)

    def _host_kick(self, conn: Conn, msg: dict) -> None:
        room = self._host_room(conn)
        if not room:
            return
        player = room.players.pop(msg.get("player_id"), None) if isinstance(msg.get("player_id"), int) else None
        if player is None:
            self._error(conn, "bad_request")
            return
        room.banned.add(player.id)
        if self.by_player.get(player.id) == room.pin:
            del self.by_player[player.id]
        if player.conn:
            player.conn.send({"type": "kicked"})
        self._broadcast(room)
        self._reveal_if_all_answered(room)

    def _host_start(self, conn: Conn, msg: dict) -> None:
        room = self._host_room(conn)
        if not room:
            return
        if room.phase != "lobby":
            self._error(conn, "bad_phase")
            return
        if not room.players:
            self._error(conn, "no_players")
            return
        room.started_at = _now_iso()
        self._open_question(room, 0)

    def _host_reveal(self, conn: Conn, msg: dict) -> None:
        room = self._host_room(conn)
        if not room:
            return
        if room.phase != "question":
            self._error(conn, "bad_phase")
            return
        self._reveal(room)

    def _host_next(self, conn: Conn, msg: dict) -> None:
        room = self._host_room(conn)
        if not room:
            return
        if room.phase == "reveal":
            room.phase = "scoreboard"
            self._broadcast(room)
        elif room.phase == "scoreboard":
            if room.index + 1 < len(room.questions):
                self._open_question(room, room.index + 1)
            else:
                room.phase = "podium"
                self._save(room)
                self._broadcast(room)
        else:
            self._error(conn, "bad_phase")

    def _host_close(self, conn: Conn, msg: dict) -> None:
        room = self._host_room(conn)
        if room:
            self._close(room, "host_closed")

    # ------------------------------------------------------------------ học sinh
    def _player_join(self, conn: Conn, msg: dict) -> None:
        user = conn.user
        pin = "".join(ch for ch in str(msg.get("pin") or "") if ch.isdigit())[:6]
        current = self._room_of_player(user["id"])
        if current and current.pin == pin:
            self.attach(conn)
            return
        now = time.monotonic()
        fails, since = self._failed_joins.get(user["id"], (0, now))
        if now - since > FAILED_JOIN_WINDOW:
            fails, since = 0, now
        if fails >= MAX_FAILED_JOINS:
            self._error(conn, "too_many")
            return
        room = self.rooms.get(pin)
        if room is None or room.phase == "podium" or not user.get("class_name") or room.class_name != user.get("class_name"):
            # Sai PIN hoặc phòng của lớp khác: cùng một thông báo để không dò được phòng của lớp khác
            self._failed_joins[user["id"]] = (fails + 1, since)
            self._error(conn, "not_found")
            return
        self._failed_joins.pop(user["id"], None)
        if user["id"] in room.banned:
            self._error(conn, "banned")
            return
        if room.locked:
            self._error(conn, "locked")
            return
        if len(room.players) >= MAX_PLAYERS:
            self._error(conn, "full")
            return
        if current:
            self._remove_player(current, user["id"])
        room.players[user["id"]] = Player(id=user["id"], name=user["full_name"], user=user, conn=conn)
        self.by_player[user["id"]] = room.pin
        self._broadcast(room)

    def _player_answer(self, conn: Conn, msg: dict) -> None:
        room = self._room_of_player(conn.user["id"])
        player = room.players.get(conn.user["id"]) if room else None
        if room is None or player is None or player.conn is not conn:
            self._error(conn, "no_room")
            return
        served = room.served[room.index] if 0 <= room.index < len(room.served) else None
        if room.phase != "question" or served is None or msg.get("question_id") != served["id"] or player.current is not None:
            self._error(conn, "bad_phase")
            return
        choice = msg.get("choice")
        option = next((i for i, o in enumerate(served["options"]) if same_key(o["key"], choice)), None)
        if option is None:
            self._error(conn, "bad_choice")
            return
        elapsed = time.monotonic() - room.q_started
        if elapsed > self.question_seconds + ANSWER_GRACE_SECONDS:
            self._error(conn, "time_up")
            return
        q = room.questions[room.index]
        correct, _ = question_bank.grade(q, choice=choice)
        player.current = {"key": choice, "correct": correct, "gain": points_for(correct, elapsed, player.streak, self.question_seconds)}
        stat = room.stats[room.index]
        stat["answered"] += 1
        stat["correct"] += 1 if correct else 0
        stat["counts"][option] += 1
        if self.record_answer:
            self._user_job(player.id, self.record_answer, player.user, q, correct)
        self._send_player(room, player)
        self._send_host(room)
        self._reveal_if_all_answered(room)

    def _player_leave(self, conn: Conn, msg: dict) -> None:
        room = self._room_of_player(conn.user["id"])
        if room:
            self._remove_player(room, conn.user["id"])
        conn.send({"type": "state", "state": None})

    # ------------------------------------------------------------------ diễn tiến trận
    def _open_question(self, room: Room, index: int) -> None:
        self._cancel_timer(room)
        room.index = index
        room.phase = "question"
        for p in room.players.values():
            p.current = None
        if len(room.stats) <= index:
            room.stats.append({"id": room.questions[index]["id"], "answered": 0, "correct": 0, "counts": [0] * len(room.served[index]["options"])})
        room.q_started = time.monotonic()
        room.deadline = room.q_started + self.question_seconds
        room.timer = asyncio.get_running_loop().create_task(self._timer(room, index))
        self._broadcast(room)

    async def _timer(self, room: Room, index: int) -> None:
        try:
            await asyncio.sleep(max(0.0, room.deadline - time.monotonic()) + 0.25)
        except asyncio.CancelledError:
            return
        if self.rooms.get(room.pin) is room and room.phase == "question" and room.index == index:
            room.timer = None
            self._reveal(room)

    def _cancel_timer(self, room: Room) -> None:
        if room.timer and room.timer is not asyncio.current_task():
            room.timer.cancel()
        room.timer = None

    def _reveal_if_all_answered(self, room: Room) -> None:
        online = [p for p in room.players.values() if p.online]
        if room.phase == "question" and online and all(p.current is not None for p in online):
            self._reveal(room)

    def _apply_reveal(self, room: Room) -> None:
        self._cancel_timer(room)
        room.phase = "reveal"
        for p in room.players.values():
            cur = p.current
            if cur:
                p.answered += 1
                p.correct += 1 if cur["correct"] else 0
                p.streak = p.streak + 1 if cur["correct"] else 0
                p.score += cur["gain"]
                p.last_gain, p.last_correct = cur["gain"], cur["correct"]
            else:
                p.streak, p.last_gain, p.last_correct = 0, 0, None

    def _reveal(self, room: Room) -> None:
        self._apply_reveal(room)
        self._broadcast(room)

    def _save(self, room: Room) -> None:
        """Lưu trận (một lần) và ghi nhận lượt học cho học sinh đã trả lời ít nhất một câu."""
        if room.saved or not room.stats or not room.players:
            return
        room.saved = True
        ranked = self._ranked(room)
        asked = len(room.stats)
        results = [
            {"user_id": p.id, "rank": i + 1, "score": p.score, "correct": p.correct, "answered": p.answered}
            for i, p in enumerate(ranked)
        ]
        session = {
            "teacher_id": room.host_id,
            "class_name": room.class_name,
            "title": room.title,
            "scope": room.scope,
            "question_count": asked,
            "question_stats": json.dumps([{"id": s["id"], "answered": s["answered"], "correct": s["correct"]} for s in room.stats]),
            "started_at": room.started_at or _now_iso(),
            "finished_at": _now_iso(),
        }
        if self.save_session:
            self._job(self.save_session, session, results, then=lambda sid: self._saved(room, sid))
        if self.record_player:
            for p in ranked:
                if p.answered:
                    self._user_job(p.id, self.record_player, p.user, p.correct, asked)

    def _saved(self, room: Room, session_id: Optional[int]) -> None:
        room.session_id = session_id
        if room.host and room.host.alive:
            if self.rooms.get(room.pin) is room:
                self._send_host(room)
            else:
                room.host.send({"type": "saved", "session_id": session_id})

    def _close(self, room: Room, reason: str) -> None:
        if self.rooms.get(room.pin) is not room:
            return
        if room.phase == "question":
            self._apply_reveal(room)
        self._cancel_timer(room)
        self._save(room)
        del self.rooms[room.pin]
        if self.by_host.get(room.host_id) == room.pin:
            del self.by_host[room.host_id]
        for p in room.players.values():
            if self.by_player.get(p.id) == room.pin:
                del self.by_player[p.id]
            if p.conn:
                p.conn.send({"type": "closed", "reason": reason})
        if room.host:
            room.host.send({"type": "room", "room": None, "closed": reason})

    def _remove_player(self, room: Room, uid: int) -> None:
        room.players.pop(uid, None)
        if self.by_player.get(uid) == room.pin:
            del self.by_player[uid]
        self._broadcast(room)
        self._reveal_if_all_answered(room)

    def _purge(self) -> None:
        now = time.monotonic()
        for room in list(self.rooms.values()):
            host_gone = room.host is None or not room.host.alive
            if (host_gone and room.host_left is not None and now - room.host_left > HOST_GRACE_SECONDS) or now - room.created > ROOM_MAX_SECONDS:
                self._close(room, "expired")

    # ------------------------------------------------------------------ dữ liệu gửi xuống
    def _serve(self, q: dict) -> dict:
        s = question_bank.serve(q, topic=self.topic_of(q["unit_id"]))
        return {
            "id": s["id"],
            "type": s["type"],
            "prompt": s["prompt"],
            "topic": s["topic"],
            "options": s.get("options") or [dict(o) for o in TF_OPTIONS],
        }

    def _reveal_info(self, room: Room, full: bool) -> dict:
        q = room.questions[room.index]
        info = {"key": q["answer"], "explanation": q["explanation"]}
        if full:
            info["counts"] = list(room.stats[room.index]["counts"])
            info["source"] = q.get("source")
        return info

    @staticmethod
    def _ranked(room: Room) -> list:
        return sorted(room.players.values(), key=lambda p: (-p.score, p.name, p.id))

    def _base_view(self, room: Room) -> dict:
        asking = room.phase in ("question", "reveal") and 0 <= room.index < len(room.served)
        return {
            "pin": room.pin,
            "title": room.title,
            "phase": room.phase,
            "index": room.index,
            "total": len(room.questions),
            "duration_ms": int(self.question_seconds * 1000),
            "remaining_ms": int(max(0.0, room.deadline - time.monotonic()) * 1000) if room.phase == "question" else 0,
            "question": room.served[room.index] if asking else None,
        }

    def _host_view(self, room: Room) -> dict:
        view = self._base_view(room)
        view.update(
            scope=room.scope,
            class_name=room.class_name,
            locked=room.locked,
            answered=sum(1 for p in room.players.values() if p.current is not None)
            if room.phase == "question"
            else (room.stats[room.index]["answered"] if 0 <= room.index < len(room.stats) else 0),
            players=[
                {
                    "id": p.id,
                    "name": p.name,
                    "score": p.score,
                    "streak": p.streak,
                    "correct": p.correct,
                    "connected": p.online,
                    "answered": p.current is not None,
                    "last_gain": p.last_gain,
                    "last_correct": p.last_correct,
                }
                for p in self._ranked(room)
            ],
            reveal=self._reveal_info(room, full=True) if room.phase == "reveal" else None,
            saved=room.saved,
            session_id=room.session_id,
        )
        return view

    def _player_view(self, room: Room, player: Player) -> dict:
        ranked = self._ranked(room)
        view = self._base_view(room)
        view.update(
            players=len(room.players),
            host_online=room.host is not None and room.host.alive,
            me={
                "name": player.name,
                "score": player.score,
                "rank": next(i + 1 for i, p in enumerate(ranked) if p.id == player.id),
                "streak": player.streak,
                "correct": player.correct,
                "answered_total": player.answered,
                "answered": player.current is not None,
                "choice": player.current["key"] if player.current else None,
                "last_gain": player.last_gain,
                "last_correct": player.last_correct,
            },
            reveal=self._reveal_info(room, full=False) if room.phase == "reveal" else None,
            top=[{"name": p.name, "score": p.score} for p in ranked[:3]] if room.phase in ("scoreboard", "podium") else [],
        )
        return view

    def _send_host(self, room: Room, conn: Optional[Conn] = None) -> None:
        target = conn or room.host
        if target:
            target.send({"type": "room", "room": self._host_view(room)})

    def _send_player(self, room: Room, player: Player) -> None:
        if player.conn:
            player.conn.send({"type": "state", "state": self._player_view(room, player)})

    def _broadcast(self, room: Room) -> None:
        self._send_host(room)
        for p in room.players.values():
            self._send_player(room, p)

    @staticmethod
    def _error(conn: Conn, code: str) -> None:
        conn.send({"type": "error", "code": code, "message": ERRORS.get(code, ERRORS["bad_request"])})

    # ------------------------------------------------------------------ tiện ích
    def _room_of_host(self, uid: int) -> Optional[Room]:
        pin = self.by_host.get(uid)
        return self.rooms.get(pin) if pin else None

    def _room_of_player(self, uid: int) -> Optional[Room]:
        pin = self.by_player.get(uid)
        room = self.rooms.get(pin) if pin else None
        return room if room and uid in room.players else None

    def _new_pin(self) -> str:
        while True:
            pin = str(100000 + secrets.randbelow(900000))
            if pin not in self.rooms:
                return pin

    def _job(self, fn: Callable, *args: Any, then: Optional[Callable[[Any], None]] = None) -> None:
        """Chạy việc ghi cơ sở dữ liệu ở luồng phụ; lỗi chỉ ghi log (không lộ chi tiết kết nối)."""

        async def run() -> None:
            try:
                result = await asyncio.to_thread(fn, *args)
            except Exception as exc:
                logger.error("Thi đấu lớp: không ghi được dữ liệu (%s)", type(exc).__name__)
                return
            if then:
                then(result)

        task = asyncio.get_running_loop().create_task(run())
        self._jobs.add(task)
        task.add_done_callback(self._jobs.discard)

    def _user_job(self, uid: int, fn: Callable, *args: Any) -> None:
        """Việc ghi tiến độ của cùng một học sinh chạy lần lượt để không ghi đè lên nhau."""
        previous = self._tails.get(uid)

        async def run() -> None:
            if previous:
                await asyncio.gather(previous, return_exceptions=True)
            try:
                await asyncio.to_thread(fn, *args)
            except Exception as exc:
                logger.error("Thi đấu lớp: không ghi được tiến độ học sinh (%s)", type(exc).__name__)

        task = asyncio.get_running_loop().create_task(run())
        self._tails[uid] = task
        self._jobs.add(task)

        def done(t: asyncio.Task) -> None:
            self._jobs.discard(t)
            if self._tails.get(uid) is t:
                del self._tails[uid]

        task.add_done_callback(done)


hub = LiveHub()
