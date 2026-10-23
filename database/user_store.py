"""Kho tài khoản người dùng.

- Có DATABASE_URL (Supabase Postgres) -> lưu vào bảng app_users trên Postgres.
- Không có -> lưu vào file SQLite cục bộ (mặc định database/data/users.db) để chạy thử trên máy.
"""
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.core.security import base_username, hash_password
from database.migrator import apply_migrations

logger = logging.getLogger(__name__)

USER_COLUMNS = "id, username, full_name, role, class_name, password_hash, must_change_password, is_active, created_at, last_login_at"

# Tiến độ học tập thật của từng học sinh (cột mới của PostgreSQL thêm bằng migration trong database/migrations)
PROGRESS_INT_FIELDS = (
    "xp", "gems", "streak", "lessons_completed", "perfect_runs", "questions_answered", "questions_correct",
    "ai_questions", "day_xp", "day_lessons", "day_correct", "day_ai_questions", "day_gems", "week_xp",
)
PROGRESS_TEXT_FIELDS = (
    "last_active_date", "day_key", "pig_state", "bkt_state", "game_state", "question_stats", "week_key", "freeze_week",
)
PROGRESS_COLUMNS = "user_id, " + ", ".join(PROGRESS_INT_FIELDS + PROGRESS_TEXT_FIELDS) + ", updated_at"
# Bản gọn (bảng xếp hạng, trang quản trị): bỏ các cột JSON lớn
PROGRESS_LIGHT_COLUMNS = "user_id, " + ", ".join(
    PROGRESS_INT_FIELDS + ("last_active_date", "day_key", "week_key", "freeze_week")
) + ", updated_at"


class DuplicateUsername(Exception):
    pass


class UserStore:
    def __init__(self) -> None:
        self.database_url = settings.DATABASE_URL
        self.kind = "postgres" if self.database_url else "sqlite"
        self.sqlite_path = Path(settings.USERS_DB_PATH)
        self.ready = False

    # ------------------------------------------------------------------ kết nối
    @contextmanager
    def _connect(self):
        if self.kind == "postgres":
            import psycopg
            from psycopg.rows import dict_row

            kwargs = {"connect_timeout": 8, "row_factory": dict_row}
            if "sslmode=" not in self.database_url:
                kwargs["sslmode"] = "require"
            with psycopg.connect(self.database_url, **kwargs) as conn:
                yield conn
        else:
            self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            finally:
                conn.close()

    def _sql(self, query: str) -> str:
        return query.replace("?", "%s") if self.kind == "postgres" else query

    def _exec(self, query: str, params: tuple = ()) -> list[dict]:
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute(self._sql(query), params)
            rows = cur.fetchall() if cur.description else []
            return [self._row(r) for r in rows]

    @staticmethod
    def _row(row) -> dict:
        data = dict(row)
        for key in ("must_change_password", "is_active"):
            if key in data:
                data[key] = bool(data[key])
        return data

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

    # ------------------------------------------------------------------ khởi tạo
    def init(self) -> None:
        self.ready = False
        if self.kind == "postgres":
            # PostgreSQL DDL lives in database/migrations, not in application code.
            apply_migrations(self.database_url)
        else:
            self._init_sqlite_schema()
        self.ensure_admin()
        self.ready = True
        where = "Postgres (DATABASE_URL)" if self.kind == "postgres" else f"SQLite ({self.sqlite_path})"
        logger.info("Kho tài khoản sẵn sàng: %s", where)

    def _init_sqlite_schema(self) -> None:
        id_col = "INTEGER PRIMARY KEY AUTOINCREMENT"
        self._exec(
            f"""
            CREATE TABLE IF NOT EXISTS app_users (
                id {id_col},
                username TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
                class_name TEXT,
                password_hash TEXT NOT NULL,
                must_change_password INTEGER NOT NULL DEFAULT 1,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                last_login_at TEXT
            )
            """
        )
        int_cols = ",\n".join(f"                {c} INTEGER NOT NULL DEFAULT 0" for c in PROGRESS_INT_FIELDS)
        text_cols = ",\n".join(f"                {c} TEXT" for c in PROGRESS_TEXT_FIELDS)
        self._exec(
            f"""
            CREATE TABLE IF NOT EXISTS app_progress (
                user_id INTEGER PRIMARY KEY,
{int_cols},
{text_cols},
                updated_at TEXT
            )
            """
        )
        # File SQLite tạo trước khi có game thiếu cột mới: bổ sung, giữ nguyên dữ liệu đang có
        existing = {r["name"] for r in self._exec("PRAGMA table_info(app_progress)")}
        for col in PROGRESS_INT_FIELDS:
            if col not in existing:
                self._exec(f"ALTER TABLE app_progress ADD COLUMN {col} INTEGER NOT NULL DEFAULT 0")
        for col in PROGRESS_TEXT_FIELDS:
            if col not in existing:
                self._exec(f"ALTER TABLE app_progress ADD COLUMN {col} TEXT")
        # Lịch sử thi đấu cả lớp (cùng cấu trúc với migration 005 của PostgreSQL)
        self._exec(
            f"""
            CREATE TABLE IF NOT EXISTS app_live_sessions (
                id {id_col},
                teacher_id INTEGER NOT NULL,
                class_name TEXT,
                title TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'all',
                question_count INTEGER NOT NULL DEFAULT 0,
                player_count INTEGER NOT NULL DEFAULT 0,
                question_stats TEXT,
                started_at TEXT NOT NULL,
                finished_at TEXT NOT NULL
            )
            """
        )
        self._exec(
            """
            CREATE TABLE IF NOT EXISTS app_live_results (
                session_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                rank INTEGER NOT NULL,
                score INTEGER NOT NULL DEFAULT 0,
                correct INTEGER NOT NULL DEFAULT 0,
                answered INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (session_id, user_id)
            )
            """
        )

    def ensure_admin(self) -> None:
        if self._exec("SELECT id FROM app_users WHERE role = 'admin' LIMIT 1"):
            return
        self.create_user(
            username=settings.ADMIN_USERNAME,
            full_name="Quản trị viên Đông A",
            role="admin",
            class_name=None,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            must_change_password=False,
        )
        logger.warning(
            "Đã tạo tài khoản quản trị '%s' (đăng nhập tại trang /admin). Nên đổi mật khẩu mặc định khi triển khai thật.",
            settings.ADMIN_USERNAME,
        )

    # ------------------------------------------------------------------ truy vấn
    def get_by_id(self, user_id: int) -> dict | None:
        rows = self._exec(f"SELECT {USER_COLUMNS} FROM app_users WHERE id = ?", (user_id,))
        return rows[0] if rows else None

    def get_by_username(self, username: str) -> dict | None:
        rows = self._exec(f"SELECT {USER_COLUMNS} FROM app_users WHERE username = ?", (username.strip().lower(),))
        return rows[0] if rows else None

    def list_users(self, role: str | None = None) -> list[dict]:
        if role:
            return self._exec(
                f"SELECT {USER_COLUMNS} FROM app_users WHERE role = ? ORDER BY class_name, full_name", (role,)
            )
        return self._exec(f"SELECT {USER_COLUMNS} FROM app_users ORDER BY role, class_name, full_name")

    def count_by_role(self) -> dict[str, int]:
        rows = self._exec("SELECT role, COUNT(*) AS total FROM app_users GROUP BY role")
        counts = {"admin": 0, "teacher": 0, "student": 0}
        for r in rows:
            counts[r["role"]] = int(r["total"])
        return counts

    def unique_username(self, full_name: str, role: str) -> str:
        base = base_username(full_name, role)
        candidate, n = base, 2
        while self.get_by_username(candidate):
            candidate, n = f"{base}{n}", n + 1
        return candidate

    # ------------------------------------------------------------------ ghi
    def create_user(
        self,
        *,
        username: str,
        full_name: str,
        role: str,
        class_name: str | None,
        password_hash: str,
        must_change_password: bool = True,
    ) -> dict:
        username = username.strip().lower()
        if self.get_by_username(username):
            raise DuplicateUsername(username)
        self._exec(
            "INSERT INTO app_users (username, full_name, role, class_name, password_hash, must_change_password, is_active, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
            (username, full_name.strip(), role, (class_name or "").strip() or None, password_hash, int(must_change_password), self._now()),
        )
        return self.get_by_username(username)  # type: ignore[return-value]

    def update_user(self, user_id: int, **fields) -> dict | None:
        allowed = {k: v for k, v in fields.items() if k in ("full_name", "class_name", "is_active") and v is not None}
        if allowed:
            if "is_active" in allowed:
                allowed["is_active"] = int(allowed["is_active"])
            sets = ", ".join(f"{k} = ?" for k in allowed)
            self._exec(f"UPDATE app_users SET {sets} WHERE id = ?", (*allowed.values(), user_id))
        return self.get_by_id(user_id)

    def set_password(self, user_id: int, password_hash: str, must_change: bool) -> None:
        self._exec(
            "UPDATE app_users SET password_hash = ?, must_change_password = ? WHERE id = ?",
            (password_hash, int(must_change), user_id),
        )

    def touch_login(self, user_id: int) -> None:
        self._exec("UPDATE app_users SET last_login_at = ? WHERE id = ?", (self._now(), user_id))

    def delete_user(self, user_id: int) -> None:
        self._exec("DELETE FROM app_progress WHERE user_id = ?", (user_id,))
        self._exec(
            "DELETE FROM app_live_results WHERE user_id = ? OR session_id IN (SELECT id FROM app_live_sessions WHERE teacher_id = ?)",
            (user_id, user_id),
        )
        self._exec("DELETE FROM app_live_sessions WHERE teacher_id = ?", (user_id,))
        self._exec("DELETE FROM app_users WHERE id = ?", (user_id,))

    # ------------------------------------------------------------------ tiến độ
    def get_progress(self, user_id: int) -> dict:
        rows = self._exec(f"SELECT {PROGRESS_COLUMNS} FROM app_progress WHERE user_id = ?", (user_id,))
        if rows:
            return dict(rows[0])
        # Nhiều yêu cầu song song của cùng một học sinh mới: chỉ một yêu cầu tạo được dòng tiến độ
        self._exec(
            "INSERT INTO app_progress (user_id, gems, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO NOTHING",
            (user_id, settings.STARTING_GEMS, self._now()),
        )
        return dict(self._exec(f"SELECT {PROGRESS_COLUMNS} FROM app_progress WHERE user_id = ?", (user_id,))[0])

    def save_progress(self, user_id: int, data: dict) -> dict:
        fields = {k: data[k] for k in PROGRESS_INT_FIELDS + PROGRESS_TEXT_FIELDS if k in data}
        fields["updated_at"] = self._now()
        sets = ", ".join(f"{k} = ?" for k in fields)
        self._exec(f"UPDATE app_progress SET {sets} WHERE user_id = ?", (*fields.values(), user_id))
        return self.get_progress(user_id)

    def all_progress(self, light: bool = False) -> dict[int, dict]:
        columns = PROGRESS_LIGHT_COLUMNS if light else PROGRESS_COLUMNS
        return {int(r["user_id"]): dict(r) for r in self._exec(f"SELECT {columns} FROM app_progress")}

    def students_in_class(self, class_name: str | None) -> list[dict]:
        if not class_name:
            return []
        return self._exec(
            f"SELECT {USER_COLUMNS} FROM app_users WHERE role = 'student' AND class_name = ? ORDER BY full_name",
            (class_name,),
        )

    # ------------------------------------------------------------------ thi đấu cả lớp
    def save_live_session(self, session: dict, results: list[dict]) -> int:
        """Lưu một trận thi đấu và kết quả từng học sinh trong cùng một giao dịch."""
        returning = " RETURNING id" if self.kind == "postgres" else ""
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute(
                self._sql(
                    "INSERT INTO app_live_sessions (teacher_id, class_name, title, scope, question_count, player_count, "
                    "question_stats, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)" + returning
                ),
                (
                    session["teacher_id"], session.get("class_name"), session["title"], session.get("scope", "all"),
                    session["question_count"], len(results), session.get("question_stats"),
                    session["started_at"], session["finished_at"],
                ),
            )
            session_id = int(dict(cur.fetchone())["id"]) if returning else int(cur.lastrowid)
            for r in results:
                cur.execute(
                    self._sql("INSERT INTO app_live_results (session_id, user_id, rank, score, correct, answered) VALUES (?, ?, ?, ?, ?, ?)"),
                    (session_id, r["user_id"], r["rank"], r["score"], r["correct"], r["answered"]),
                )
            return session_id

    def live_sessions_for_teacher(self, teacher_id: int, limit: int = 10) -> list[dict]:
        sessions = self._exec(
            "SELECT id, class_name, title, scope, question_count, player_count, question_stats, started_at, finished_at "
            "FROM app_live_sessions WHERE teacher_id = ? ORDER BY finished_at DESC, id DESC LIMIT ?",
            (teacher_id, limit),
        )
        if not sessions:
            return []
        ids = [s["id"] for s in sessions]
        marks = ", ".join("?" for _ in ids)
        rows = self._exec(
            f"SELECT r.session_id, r.user_id, u.full_name, r.rank, r.score, r.correct, r.answered "
            f"FROM app_live_results r JOIN app_users u ON u.id = r.user_id WHERE r.session_id IN ({marks}) "
            f"ORDER BY r.session_id, r.rank",
            tuple(ids),
        )
        by_session: dict[int, list[dict]] = {}
        for r in rows:
            by_session.setdefault(int(r["session_id"]), []).append(r)
        return [{**s, "results": by_session.get(int(s["id"]), [])} for s in sessions]


store = UserStore()
