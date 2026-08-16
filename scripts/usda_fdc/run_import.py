#!/usr/bin/env python3
"""Import data/import_usda_fdc.sql into Postgres in a single transaction.

Does not run unless you start it. Connection URL comes from SUPABASE_DB_URL
(set in the shell; do not commit it).

    pip install psycopg2-binary
    SUPABASE_DB_URL='postgresql://…' python3 scripts/usda_fdc/run_import.py
"""

from __future__ import annotations

import os
import re
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SQL_PATH = ROOT / "data" / "import_usda_fdc.sql"
EXPECTED_BATCHES = 17
COUNT_SQL = "SELECT count(*) FROM public.foods WHERE source = 'usda_fdc'"
NOTIFY_SQL = "NOTIFY pgrst, 'reload schema'"

BATCH_HEAD = re.compile(
    r"^-- batch (\d+)/(\d+) rows (\d+)-(\d+)\s*$",
    re.MULTILINE,
)
TRAILING_NOTIFY = re.compile(
    r"NOTIFY\s+pgrst\s*,\s*'reload schema'\s*;?\s*$",
    re.IGNORECASE,
)


def load_batches(path: Path) -> list[tuple[int, int, int, str]]:
    if not path.is_file():
        raise SystemExit(f"missing SQL file: {path}")
    text = path.read_text(encoding="utf-8")
    matches = list(BATCH_HEAD.finditer(text))
    if len(matches) != EXPECTED_BATCHES:
        raise SystemExit(
            f"expected {EXPECTED_BATCHES} batches in {path}, found {len(matches)}"
        )
    batches: list[tuple[int, int, int, str]] = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sql = TRAILING_NOTIFY.sub("", text[start:end]).strip()
        if not sql:
            raise SystemExit(f"empty SQL for batch {match.group(1)}")
        row_start = int(match.group(3))
        row_end = int(match.group(4))
        batches.append(
            (
                int(match.group(1)),
                int(match.group(2)),
                row_end - row_start + 1,
                sql,
            )
        )
    return batches


def db_url() -> str:
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        raise SystemExit("SUPABASE_DB_URL is not set")
    return url


def print_error(exc: BaseException) -> None:
    traceback.print_exc()
    print(f"\n{type(exc).__name__}: {exc}", file=sys.stderr)
    pgerror = getattr(exc, "pgerror", None)
    if pgerror:
        print(pgerror, file=sys.stderr)
    diag = getattr(exc, "diag", None)
    if diag is not None:
        for attr in (
            "message_primary",
            "message_detail",
            "message_hint",
            "context",
            "schema_name",
            "table_name",
            "column_name",
            "constraint_name",
            "sqlstate",
        ):
            value = getattr(diag, attr, None)
            if value:
                print(f"  {attr}: {value}", file=sys.stderr)


def rollback(cur) -> None:
    try:
        cur.execute("ROLLBACK")
        print("ROLLBACK", file=sys.stderr)
    except Exception as rollback_exc:  # noqa: BLE001
        print(f"ROLLBACK failed: {rollback_exc}", file=sys.stderr)


def main() -> None:
    batches = load_batches(SQL_PATH)
    try:
        import psycopg2
    except ImportError:
        raise SystemExit("psycopg2 is not installed (pip install psycopg2-binary)") from None

    conn = psycopg2.connect(db_url())
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("BEGIN")
        for batch_id, total, n_rows, sql in batches:
            cur.execute(sql)
            cur.execute(COUNT_SQL)
            (usda_count,) = cur.fetchone()
            print(
                f"batch {batch_id}/{total}, {n_rows} rows "
                f"(foods source=usda_fdc count={usda_count})"
            )
        cur.execute(NOTIFY_SQL)
        print("NOTIFY pgrst, 'reload schema'")
        cur.execute("COMMIT")
        print("COMMIT")
    except Exception as exc:  # noqa: BLE001
        print_error(exc)
        rollback(cur)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
