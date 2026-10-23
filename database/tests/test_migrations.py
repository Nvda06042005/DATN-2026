"""Migration behavior against an isolated temporary PostgreSQL cluster; no real data."""
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE = PROJECT_ROOT / "database"
BACKEND = PROJECT_ROOT / "backend"
for _path in (PROJECT_ROOT, BACKEND):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from database.migrator import MIGRATIONS_DIR, MigrationError, apply_migrations, load_migrations, migration_status  # noqa: E402


class MigrationFileTests(unittest.TestCase):
    def test_unreadable_encoding_fails_as_migration_error(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "001_broken.sql").write_bytes(b"\xff")
            with self.assertRaisesRegex(MigrationError, "Cannot read UTF-8"):
                load_migrations(Path(directory))

    def test_windows_and_linux_line_endings_have_same_checksum(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "001_first.sql"
            path.write_bytes(b"SELECT 1;\r\n")
            windows = load_migrations(Path(directory))[0].checksum
            path.write_bytes(b"SELECT 1;\n")
            self.assertEqual(windows, load_migrations(Path(directory))[0].checksum)

    def test_rejects_duplicate_versions_and_comment_only_scaffold(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "001_first.sql").write_text("SELECT 1;")
            (root / "001_second.sql").write_text("SELECT 2;")
            with self.assertRaisesRegex(MigrationError, "Duplicate"):
                load_migrations(root)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "001_empty.sql").write_text("-- TODO\n/* no statements */")
            with self.assertRaisesRegex(MigrationError, "no SQL"):
                load_migrations(root)

    def test_rejects_transaction_escape_but_allows_do_blocks_and_literals(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "001_guard.sql"
            for sql in ("BEGIN; SELECT 1; COMMIT;", "SELECT 1; COMMIT;", "CREATE INDEX CONCURRENTLY idx ON x (id);", "VACUUM;"):
                path.write_text(sql)
                with self.subTest(sql=sql), self.assertRaises(MigrationError):
                    load_migrations(root)
            path.write_text("/* nested /* comment */ */ DO $body$ BEGIN PERFORM 1; END $body$; SELECT 'COMMIT;', E'\\\\';")
            self.assertEqual(len(load_migrations(root)), 1)

    def test_check_cli_needs_no_database(self):
        env = dict(os.environ, DATABASE_URL="")
        result = subprocess.run([sys.executable, str(DATABASE / "migrate.py"), "check"], env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.count("OK "), 5)


def postgres_bin():
    configured = os.environ.get("POSTGRES_BIN")
    if configured:
        return Path(configured)
    initdb = shutil.which("initdb")
    if initdb:
        return Path(initdb).parent
    base = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "PostgreSQL"
    for directory in sorted(base.glob("*/bin"), reverse=True):
        if (directory / "initdb.exe").is_file():
            return directory
    return None


class PostgresMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg
        cls.psycopg = psycopg
        cls.bin = postgres_bin()
        if cls.bin is None:
            raise unittest.SkipTest("PostgreSQL initdb/pg_ctl not installed; set POSTGRES_BIN")
        cls.temp = tempfile.TemporaryDirectory(prefix="dong_a_migrations_test_")
        cls.root = Path(cls.temp.name).resolve()
        cls.data = cls.root / "pgdata"
        cls.log = cls.root / "postgres.log"
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = sock.getsockname()[1]
        cls.base_url = f"postgresql://test_migrator@127.0.0.1:{cls.port}/postgres?sslmode=disable"
        cls.started = False
        try:
            cls.run_pg("initdb", "-D", str(cls.data), "-U", "test_migrator", "-A", "trust", "-E", "UTF8", "--no-locale")
            cls.run_pg("pg_ctl", "-D", str(cls.data), "-l", str(cls.log), "-o", f"-h 127.0.0.1 -p {cls.port}", "-w", "start")
            cls.started = True
        except Exception:
            cls.tearDownClass()
            raise

    @classmethod
    def run_pg(cls, binary, *args):
        suffix = ".exe" if os.name == "nt" else ""
        # Postgres background children can inherit pipe handles on Windows and keep
        # subprocess.communicate() waiting after pg_ctl exits. Use a file, not pipes.
        output = cls.root / (binary + "-command.log")
        with output.open("w", encoding="utf-8") as stream:
            result = subprocess.run([str(cls.bin / (binary + suffix)), *args], stdin=subprocess.DEVNULL,
                                    stdout=stream, stderr=subprocess.STDOUT, timeout=60,
                                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        if result.returncode:
            raise RuntimeError(f"{binary} failed: {output.read_text(encoding='utf-8', errors='replace')}")

    @classmethod
    def tearDownClass(cls):
        if getattr(cls, "started", False):
            cls.run_pg("pg_ctl", "-D", str(cls.data), "-m", "fast", "-w", "stop")
            cls.started = False
        if hasattr(cls, "temp"):
            # Verify the recursive cleanup target is our explicitly named temporary cluster.
            assert cls.root.parent == Path(tempfile.gettempdir()).resolve()
            assert cls.root.name.startswith("dong_a_migrations_test_")
            cls.temp.cleanup()

    def setUp(self):
        from psycopg import sql
        self.dbname = "migration_" + self._testMethodName
        with self.psycopg.connect(self.base_url, autocommit=True) as conn:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(self.dbname)))
        self.url = self.base_url.replace("/postgres?", "/" + self.dbname + "?")
        self.files = tempfile.TemporaryDirectory(prefix="dong_a_migration_files_")
        self.addCleanup(self.files.cleanup)
        self.directory = Path(self.files.name)
        for path in MIGRATIONS_DIR.glob("*.sql"):
            shutil.copyfile(path, self.directory / path.name)

    def query(self, sql, params=None):
        with self.psycopg.connect(self.url, autocommit=True) as conn:
            cursor = conn.execute(sql, params)
            return cursor.fetchall() if cursor.description else []

    def test_status_is_read_only_and_fresh_apply_is_repeatable(self):
        self.assertTrue(all(not row["applied"] for row in migration_status(self.url, self.directory)))
        self.assertEqual(self.query("SELECT to_regclass('public.app_schema_migrations')"), [(None,)])
        self.assertEqual(len(apply_migrations(self.url, self.directory)), 5)
        self.assertEqual(apply_migrations(self.url, self.directory), [])
        self.assertTrue(all(row["applied"] for row in migration_status(self.url, self.directory)))
        self.assertEqual(self.query("SELECT count(*) FROM public.app_schema_migrations"), [(5,)])
        self.assertEqual(self.query("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity"), [(9,)])

    def test_existing_imported_rows_and_prisma_history_are_preserved(self):
        self.query((self.directory / "001_initial_postgres_schema.sql").read_text(encoding="utf-8"))
        self.query('''INSERT INTO public."User" (id,email,"passwordHash","fullName","updatedAt")
                      VALUES ('legacy-id','fixture@example.invalid','fake-hash','Fixture',now())''')
        self.query("INSERT INTO public._prisma_migrations (id,checksum,migration_name) VALUES ('fixture','original-checksum','original-import')")
        self.assertEqual(len(apply_migrations(self.url, self.directory)), 5)
        self.assertEqual(self.query('SELECT id,email FROM public."User"'), [("legacy-id", "fixture@example.invalid")])
        self.assertEqual(self.query("SELECT checksum FROM public._prisma_migrations"), [("original-checksum",)])

    def test_failure_rolls_back_entire_pending_batch_and_history(self):
        apply_migrations(self.url, self.directory)
        (self.directory / "006_create_marker.sql").write_text("CREATE TABLE public.rollback_marker (id INT);")
        (self.directory / "007_fail.sql").write_text("SELECT * FROM deliberately_missing_relation;")
        with self.assertRaisesRegex(MigrationError, "42P01"):
            apply_migrations(self.url, self.directory)
        self.assertEqual(self.query("SELECT to_regclass('public.rollback_marker')"), [(None,)])
        self.assertEqual(self.query("SELECT count(*) FROM public.app_schema_migrations"), [(5,)])
        (self.directory / "007_fail.sql").write_text("INSERT INTO public.rollback_marker VALUES (1);")
        self.assertEqual(len(apply_migrations(self.url, self.directory)), 2)
        self.assertEqual(self.query("SELECT id FROM public.rollback_marker"), [(1,)])

    def test_changed_or_missing_applied_file_is_rejected(self):
        apply_migrations(self.url, self.directory)
        path = self.directory / "002_app_users.sql"
        original = path.read_text(encoding="utf-8")
        path.write_text(original + "\n-- changed after applying\n", encoding="utf-8")
        with self.assertRaisesRegex(MigrationError, "was changed"):
            apply_migrations(self.url, self.directory)
        renamed = self.directory / "002_renamed.sql"
        path.rename(renamed)
        with self.assertRaisesRegex(MigrationError, "was changed"):
            migration_status(self.url, self.directory)
        renamed.rename(self.directory / "removed_migration.txt")
        with self.assertRaisesRegex(MigrationError, "is missing"):
            apply_migrations(self.url, self.directory)

    def test_old_pending_version_is_rejected(self):
        apply_migrations(self.url, self.directory)
        (self.directory / "000_inserted_late.sql").write_text("SELECT 1;")
        with self.assertRaisesRegex(MigrationError, "inserted before"):
            apply_migrations(self.url, self.directory)

    def test_concurrent_workers_run_each_file_once(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(apply_migrations, self.url, self.directory) for _ in range(2)]
            self.assertEqual(sorted(len(f.result()) for f in futures), [0, 5])
        self.assertEqual(self.query("SELECT count(*) FROM public.app_schema_migrations"), [(5,)])

    def test_user_store_startup_applies_migrations_and_can_write_progress(self):
        from app.config import settings
        from app.core.security import hash_password
        from database.user_store import UserStore
        with patch.object(settings, "DATABASE_URL", self.url):
            store = UserStore()
        store.init()
        self.assertTrue(store.ready)
        user = store.create_user(username="migration_student", full_name="Fixture", role="student", class_name="7A", password_hash=hash_password("fixture-only"))
        progress = store.get_progress(user["id"])
        self.assertEqual(progress["gems"], settings.STARTING_GEMS)
        self.assertEqual(store.save_progress(user["id"], {"xp": 42})["xp"], 42)
        saved = store.save_progress(user["id"], {"game_state": '{"campaign":{"m1p1":3}}', "day_gems": 20, "week_xp": 42, "week_key": "2026-W43"})
        self.assertEqual((saved["game_state"], saved["day_gems"], saved["week_xp"]), ('{"campaign":{"m1p1":3}}', 20, 42))
        self.assertNotIn("game_state", store.all_progress(light=True)[user["id"]])
        store.init()
        self.assertEqual(store.get_by_username("migration_student")["id"], user["id"])
        self.assertEqual(store.get_progress(user["id"])["xp"], 42)
        self.assertEqual(self.query("SELECT count(*) FROM public.app_schema_migrations"), [(5,)])
        assert_live_sessions_round_trip(self, store, user, self.query)


def assert_live_sessions_round_trip(test, store, student, query=None):
    """Lưu một trận thi đấu lớp, đọc lại kèm tên học sinh; xóa tài khoản thì xóa luôn dữ liệu trận liên quan."""
    from app.core.security import hash_password
    teacher = store.create_user(username="live_teacher", full_name="Fixture GV", role="teacher", class_name="7A", password_hash=hash_password("fixture-only"))
    session_id = store.save_live_session(
        {"teacher_id": teacher["id"], "class_name": "7A", "title": "Thi thử", "scope": "all", "question_count": 2,
         "question_stats": '[{"id":"q1","answered":1,"correct":1}]',
         "started_at": "2026-10-22T08:00:00+00:00", "finished_at": "2026-10-22T08:05:00+00:00"},
        [{"user_id": student["id"], "rank": 1, "score": 1800, "correct": 2, "answered": 2}],
    )
    sessions = store.live_sessions_for_teacher(teacher["id"])
    test.assertEqual([(s["id"], s["player_count"], s["question_count"]) for s in sessions], [(session_id, 1, 2)])
    test.assertEqual([(r["full_name"], r["rank"], r["score"]) for r in sessions[0]["results"]], [(student["full_name"], 1, 1800)])
    store.delete_user(student["id"])
    test.assertEqual(store.live_sessions_for_teacher(teacher["id"])[0]["results"], [])
    store.delete_user(teacher["id"])
    test.assertEqual(store.live_sessions_for_teacher(teacher["id"]), [])
    if query:
        test.assertEqual(query("SELECT count(*) FROM public.app_live_sessions"), [(0,)])
        test.assertEqual(query("SELECT count(*) FROM public.app_live_results"), [(0,)])


class SQLiteCompatibilityTests(unittest.TestCase):
    def test_sqlite_still_initializes_and_keeps_existing_progress(self):
        from app.config import settings
        from database.user_store import UserStore
        with tempfile.TemporaryDirectory() as directory, patch.object(settings, "DATABASE_URL", ""), patch.object(settings, "USERS_DB_PATH", str(Path(directory) / "users.db")):
            store = UserStore()
            store.init()
            admin = store.get_by_username(settings.ADMIN_USERNAME)
            store.get_progress(admin["id"])
            store.save_progress(admin["id"], {"xp": 15})
            store.init()
            self.assertTrue(store.ready)
            self.assertEqual(store.get_progress(admin["id"])["xp"], 15)
            from app.core.security import hash_password
            student = store.create_user(username="live_student", full_name="Fixture HS", role="student", class_name="7A", password_hash=hash_password("fixture-only"))
            assert_live_sessions_round_trip(self, store, student)

    def test_old_sqlite_file_gains_game_columns_without_losing_progress(self):
        import sqlite3
        from app.config import settings
        from database.user_store import PROGRESS_INT_FIELDS, PROGRESS_TEXT_FIELDS, UserStore
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "users.db"
            # Lược đồ app_progress trước khi có game Hào Khí Đông A
            conn = sqlite3.connect(path)
            old_ints = ", ".join(f"{c} INTEGER NOT NULL DEFAULT 0" for c in (
                "xp", "gems", "streak", "lessons_completed", "perfect_runs", "questions_answered", "questions_correct",
                "ai_questions", "day_xp", "day_lessons", "day_correct", "day_ai_questions"))
            conn.execute(f"CREATE TABLE app_progress (user_id INTEGER PRIMARY KEY, {old_ints}, last_active_date TEXT, "
                         "day_key TEXT, pig_state TEXT, bkt_state TEXT, updated_at TEXT)")
            conn.execute("INSERT INTO app_progress (user_id, xp, gems, bkt_state) VALUES (7, 120, 340, '{}')")
            conn.commit()
            conn.close()
            with patch.object(settings, "DATABASE_URL", ""), patch.object(settings, "USERS_DB_PATH", str(path)):
                store = UserStore()
                store.init()
                progress = store.get_progress(7)
                self.assertEqual((progress["xp"], progress["gems"]), (120, 340))
                for column in PROGRESS_INT_FIELDS + PROGRESS_TEXT_FIELDS:
                    self.assertIn(column, progress)
                self.assertEqual(store.save_progress(7, {"game_state": '{"v":1}', "day_gems": 10})["game_state"], '{"v":1}')
                store.init()  # chạy lại không thêm cột trùng
                self.assertEqual(store.get_progress(7)["day_gems"], 10)


if __name__ == "__main__":
    unittest.main()
