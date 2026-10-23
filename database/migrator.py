"""Ordered, checksummed PostgreSQL migrations shared by startup and the CLI."""
import hashlib
import logging
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)
MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
LOCK_ID = 0x444F4E47415F4442
FILENAME = re.compile(r"([0-9]{3,})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql\Z")


class MigrationError(RuntimeError):
    """A safe-to-log migration error: never contains credentials or SQL data."""


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    sql: str
    checksum: str


def _validate_sql(sql: str, name: str) -> None:
    """Inspect top-level commands, ignoring comments, strings and DO bodies."""
    plain = []
    i = 0
    while i < len(sql):
        if sql.startswith("--", i):
            end = sql.find("\n", i)
            i = len(sql) if end < 0 else end + 1
            plain.append(" ")
        elif sql.startswith("/*", i):
            depth = 1
            i += 2
            while i < len(sql) and depth:
                if sql.startswith("/*", i):
                    depth += 1
                    i += 2
                elif sql.startswith("*/", i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
            if depth:
                raise MigrationError(f"Unclosed SQL comment: {name}")
            plain.append(" ")
        elif sql[i] in "'\"":
            quote = sql[i]
            escape_string = quote == "'" and i > 0 and sql[i - 1] in "eE" and (i < 2 or not (sql[i - 2].isalnum() or sql[i - 2] == "_"))
            i += 1
            while i < len(sql):
                if escape_string and sql[i] == "\\":
                    i += 2
                elif sql[i] == quote:
                    i += 1
                    if i < len(sql) and sql[i] == quote:
                        i += 1
                    else:
                        break
                else:
                    i += 1
            else:
                raise MigrationError(f"Unclosed SQL string: {name}")
            plain.append(" ")
        elif sql[i] == "$" and (tag := re.match(r"\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$", sql[i:])):
            end = sql.find(tag[0], i + len(tag[0]))
            if end < 0:
                raise MigrationError(f"Unclosed SQL dollar quote: {name}")
            i = end + len(tag[0])
            plain.append(" ")
        else:
            plain.append(sql[i])
            i += 1
    commands = [part.strip().upper() for part in "".join(plain).split(";") if part.strip()]
    if not commands:
        raise MigrationError(f"Migration has no SQL statements: {name}")
    for command in commands:
        first = command.split()[0]
        if first in {"BEGIN", "START", "COMMIT", "END", "ROLLBACK", "ABORT", "SAVEPOINT", "RELEASE", "VACUUM", "DISCARD"} or re.match(
            r"(?:PREPARE\s+TRANSACTION|ALTER\s+SYSTEM|(?:CREATE|DROP)\s+DATABASE|(?:CREATE\s+(?:UNIQUE\s+)?INDEX|REINDEX\b.*?)\s+CONCURRENTLY)\b", command
        ):
            raise MigrationError(f"Migration must run inside the runner's transaction: {name}")


def load_migrations(directory: Path = MIGRATIONS_DIR) -> list[Migration]:
    if not directory.is_dir():
        raise MigrationError("Migration directory is missing")
    result = []
    versions = set()
    for path in sorted(directory.glob("*.sql")):
        match = FILENAME.fullmatch(path.name)
        if not match:
            raise MigrationError(f"Invalid migration filename: {path.name}")
        version = int(match[1])
        if version in versions:
            raise MigrationError(f"Duplicate migration number: {version}")
        versions.add(version)
        # Normalize line endings: Windows checkout must have the same checksum as Render.
        try:
            sql = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
        except (OSError, UnicodeError):
            raise MigrationError(f"Cannot read UTF-8 migration: {path.name}") from None
        if not sql.strip():
            raise MigrationError(f"Empty migration: {path.name}")
        _validate_sql(sql, path.name)
        result.append(Migration(version, path.name, sql, hashlib.sha256(sql.encode("utf-8")).hexdigest()))
    if not result:
        raise MigrationError("No SQL migrations found")
    return sorted(result, key=lambda migration: migration.version)


def _connect(database_url: str):
    if not database_url.strip():
        raise MigrationError("DATABASE_URL is required for PostgreSQL migrations")
    import psycopg
    from psycopg.conninfo import conninfo_to_dict

    options = conninfo_to_dict(database_url)
    # Explicit sslmode=disable is supported for an isolated local test database.
    return psycopg.connect(database_url, connect_timeout=10, sslmode=options.get("sslmode", "require"), autocommit=True, prepare_threshold=None)


def _history(conn) -> dict[int, tuple[str, str]]:
    exists = conn.execute("SELECT to_regclass('public.app_schema_migrations')").fetchone()[0]
    if not exists:
        return {}
    return {version: (name, checksum) for version, name, checksum in conn.execute(
        "SELECT version, name, checksum FROM public.app_schema_migrations ORDER BY version"
    ).fetchall()}


def _validate_history(migrations: list[Migration], history: dict) -> None:
    files = {migration.version: migration for migration in migrations}
    for version, (name, checksum) in history.items():
        if version not in files:
            raise MigrationError(f"Applied migration is missing from this release: {name}")
        if (files[version].name, files[version].checksum) != (name, checksum):
            raise MigrationError(f"Applied migration was changed: {name}; create a new SQL file")
    if history and any(m.version < max(history) and m.version not in history for m in migrations):
        raise MigrationError("A pending migration was inserted before applied migrations")


def _safe_database_error(exc: Exception) -> MigrationError:
    sqlstate = getattr(exc, "sqlstate", None) or "unavailable"
    return MigrationError(f"PostgreSQL migration failed ({type(exc).__name__}, SQLSTATE {sqlstate}); connection and SQL details omitted")


def migration_status(database_url: str, directory: Path = MIGRATIONS_DIR) -> list[dict]:
    """Inspect history without creating tables or applying SQL."""
    migrations = load_migrations(directory)
    try:
        with _connect(database_url) as conn, conn.transaction():
            conn.execute("SET TRANSACTION READ ONLY")
            history = _history(conn)
            _validate_history(migrations, history)
            return [{"name": m.name, "applied": m.version in history} for m in migrations]
    except MigrationError:
        raise
    except Exception as exc:
        raise _safe_database_error(exc) from None


def apply_migrations(database_url: str, directory: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply the pending batch atomically. Concurrent workers serialize on one xact lock."""
    migrations = load_migrations(directory)
    applied = []
    try:
        with _connect(database_url) as conn, conn.transaction():
            conn.execute("SET LOCAL lock_timeout = '30s'")
            conn.execute("SET LOCAL statement_timeout = '120s'")
            conn.execute("SET LOCAL standard_conforming_strings = on")
            conn.execute("SET LOCAL search_path = public, pg_catalog")
            conn.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_ID,))
            conn.execute("""
                CREATE TABLE IF NOT EXISTS public.app_schema_migrations (
                    version BIGINT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    checksum TEXT NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            conn.execute("ALTER TABLE public.app_schema_migrations ENABLE ROW LEVEL SECURITY")
            history = _history(conn)
            _validate_history(migrations, history)
            for migration in migrations:
                if migration.version in history:
                    continue
                logger.info("Applying database migration %s", migration.name)
                conn.execute(migration.sql, prepare=False)
                conn.execute(
                    "INSERT INTO public.app_schema_migrations (version, name, checksum) VALUES (%s, %s, %s)",
                    (migration.version, migration.name, migration.checksum),
                )
                applied.append(migration.name)
        logger.info("Database migrations ready: %d newly applied", len(applied))
        return applied
    except MigrationError:
        raise
    except Exception as exc:
        raise _safe_database_error(exc) from None
