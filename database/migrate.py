"""Usage: python migrate.py [up|status|check|new migration_name]."""
import argparse
import logging
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from database.migrator import MIGRATIONS_DIR, MigrationError, apply_migrations, load_migrations, migration_status  # noqa: E402


def main() -> int:
    # Resolve backend/.env, independent of the caller's current directory.
    import os
    load_dotenv(PROJECT_ROOT / "backend" / ".env")
    parser = argparse.ArgumentParser(description="Apply ordered SQL migrations to DATABASE_URL")
    parser.add_argument("command", choices=("up", "status", "check", "new"), nargs="?", default="up")
    parser.add_argument("name", nargs="?")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        migrations = load_migrations()
        if args.command == "check":
            for migration in migrations:
                print(f"OK {migration.name}")
        elif args.command == "new":
            if not args.name or not re.fullmatch(r"[a-z0-9]+(?:_[a-z0-9]+)*", args.name):
                parser.error("Use a migration name such as add_student_badges")
            version = max(m.version for m in migrations) + 1
            path = MIGRATIONS_DIR / f"{version:03d}_{args.name}.sql"
            with path.open("x", encoding="utf-8", newline="\n") as stream:
                stream.write("-- " + args.name + "\n-- Add forward-only SQL here. The runner manages the transaction.\n")
            print(path.name)
        elif args.command == "status":
            for status in migration_status(os.environ.get("DATABASE_URL", "")):
                print(f"{'APPLIED' if status['applied'] else 'PENDING'} {status['name']}")
        else:
            applied = apply_migrations(os.environ.get("DATABASE_URL", ""))
            print(f"Database ready: {len(applied)} new migration(s)")
        return 0
    except MigrationError as exc:
        logging.error("%s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
