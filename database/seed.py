"""Apply schema.sql and seed.sql to the database in DATABASE_URL. Safe to run repeatedly.

Usage (from repo root):  python database/seed.py
"""
import os
import sys
from pathlib import Path

import psycopg

HERE = Path(__file__).parent


def load_env_file() -> None:
    """Tiny .env loader so the script works without extra dependencies."""
    for candidate in (HERE.parent / ".env", HERE.parent / "backend" / ".env"):
        if candidate.exists():
            for line in candidate.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
            return


def main() -> int:
    load_env_file()
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set. Copy .env.example to .env and fill it in.", file=sys.stderr)
        return 1
    with psycopg.connect(url, prepare_threshold=None, autocommit=True) as conn:
        conn.execute((HERE / "schema.sql").read_text())
        conn.execute((HERE / "seed.sql").read_text())
        rows = conn.execute(
            "select client_name, coalesce(phone, '(missing)'), "
            "to_char(starts_at at time zone 'Asia/Kolkata', 'DD/MM/YYYY HH24:MI'), status "
            "from appointments where source = 'sample' order by starts_at"
        ).fetchall()
    print("Schema applied. Sample appointments in database:")
    for r in rows:
        print("  ", " | ".join(r))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
