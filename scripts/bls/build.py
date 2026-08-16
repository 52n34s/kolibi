#!/usr/bin/env python3
"""Parse BLS 4.0 Excel into a local foods import CSV.

Does not write to Supabase. Empty protein/fat/carbs/fiber/sugar/sodium become 0
(not blank/NULL) so later SQL INSERTs do not bypass the table default.

    python3 scripts/bls/download.py
    python3 scripts/bls/build.py
"""

from __future__ import annotations

import csv
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "usda_fdc"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from download import download_all  # noqa: E402
from kolibi_fold import kolibi_fold, kolibi_slug  # noqa: E402

DATA_DIR = ROOT / "data"
IMPORT_CSV_PATH = DATA_DIR / "bls_import.csv"
SKIPPED_PATH = DATA_DIR / "bls_skipped_no_kcal.csv"
COLLISIONS_PATH = DATA_DIR / "bls_slug_collisions.csv"

SOURCE = "bls_4_0"
SOURCE_DESC = "Bundeslebensmittelschlüssel 4.0, Max Rubner-Institut"
SHEET_NAME = "BLS_4_0_Daten_2025_DE"

COL_CODE = "BLS Code"
COL_DE = "Lebensmittelbezeichnung"
COL_EN = "Food name"
COL_KCAL = "ENERCC Energie (Kilokalorien) [kcal/100g]"
COL_PROTEIN = "PROT625 Protein (Nx6,25) [g/100g]"
COL_FAT = "FAT Fett [g/100g]"
COL_CARBS = "CHO Kohlenhydrate, verfügbar [g/100g]"
COL_FIBER = "FIBT Ballaststoffe, gesamt [g/100g]"
COL_SUGAR = "SUGAR Zucker (Mono- und Disaccharide), gesamt [g/100g]"
COL_SODIUM = "NA Natrium [mg/100g]"

REQUIRED_COLUMNS = (
    COL_CODE,
    COL_DE,
    COL_EN,
    COL_KCAL,
    COL_PROTEIN,
    COL_FAT,
    COL_CARBS,
    COL_FIBER,
    COL_SUGAR,
    COL_SODIUM,
)

CSV_COLUMNS = [
    "name",
    "name_normalized",
    "source",
    "source_ref",
    "kcal_per_100g",
    "protein_per_100g",
    "carbs_per_100g",
    "fat_per_100g",
    "fiber_per_100g",
    "sugar_per_100g",
    "sodium_mg_per_100g",
    "is_countable",
    "category",
    "bls_group",
    "is_verified",
    "names",
    "search_terms",
    "slug",
    "source_desc",
]


def parse_amount(raw: object) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        value = float(raw)
        if value != value:  # NaN
            return None
        return value
    text = str(raw).strip()
    if not text:
        return None
    try:
        value = float(text.replace(",", "."))
    except ValueError:
        return None
    if value != value:
        return None
    return value


def format_number(value: float | None) -> str:
    if value is None:
        return ""
    if value == int(value):
        return str(int(value))
    return f"{value:.4f}".rstrip("0").rstrip(".")


def format_zero(value: float | None) -> str:
    """Missing macros/sodium → 0, never a blank that becomes SQL NULL."""
    return format_number(0.0 if value is None else value)


def cell_text(raw: object) -> str:
    if raw is None:
        return ""
    return str(raw).strip()


def load_rows(xlsx_path: Path) -> list[dict[str, object]]:
    try:
        from openpyxl import load_workbook
    except ImportError:
        raise SystemExit("openpyxl is not installed (pip install openpyxl)") from None

    workbook = load_workbook(xlsx_path, read_only=True, data_only=True)
    try:
        if SHEET_NAME not in workbook.sheetnames:
            raise SystemExit(
                f"missing sheet {SHEET_NAME!r} in {xlsx_path} "
                f"(have {workbook.sheetnames})"
            )
        sheet = workbook[SHEET_NAME]
        iterator = sheet.iter_rows(values_only=True)
        header_row = next(iterator, None)
        if not header_row:
            raise SystemExit(f"empty workbook: {xlsx_path}")
        headers = [cell_text(col) for col in header_row]
        missing = [name for name in REQUIRED_COLUMNS if name not in headers]
        if missing:
            raise SystemExit(f"missing columns: {missing}")
        index = {name: headers.index(name) for name in REQUIRED_COLUMNS}
        rows: list[dict[str, object]] = []
        for raw in iterator:
            rows.append({name: raw[pos] if pos < len(raw) else None for name, pos in index.items()})
        return rows
    finally:
        workbook.close()


def assign_slugs(records: list[dict]) -> list[dict]:
    collisions: list[dict] = []
    grouped: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        base = kolibi_slug(record["name"]) or f"food_{record['source_ref']}"
        record["_base_slug"] = base
        grouped[base].append(record)

    for base, items in grouped.items():
        if len(items) == 1:
            items[0]["slug"] = base
            continue
        for item in items:
            slug = f"{base}_{item['source_ref']}"
            item["slug"] = slug
            collisions.append(
                {
                    "base_slug": base,
                    "source_ref": item["source_ref"],
                    "name": item["name"],
                    "name_de": item["name_de"],
                    "final_slug": slug,
                }
            )
    return collisions


def to_import_row(record: dict) -> dict[str, str]:
    names = {"en": record["name"], "de": record["name_de"], "es": None}
    return {
        "name": record["name"],
        "name_normalized": kolibi_fold(record["name"]),
        "source": SOURCE,
        "source_ref": record["source_ref"],
        "kcal_per_100g": format_number(record["kcal"]),
        "protein_per_100g": format_zero(record["protein"]),
        "carbs_per_100g": format_zero(record["carbs"]),
        "fat_per_100g": format_zero(record["fat"]),
        "fiber_per_100g": format_zero(record["fiber"]),
        "sugar_per_100g": format_zero(record["sugar"]),
        "sodium_mg_per_100g": format_zero(record["sodium_mg"]),
        "is_countable": "false",
        "category": "",
        "bls_group": record["bls_group"],
        "is_verified": "true",
        "names": json.dumps(names, ensure_ascii=False, separators=(",", ":")),
        "search_terms": "[]",
        "slug": record["slug"],
        "source_desc": SOURCE_DESC,
    }


def build() -> dict:
    xlsx_path = download_all()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    kept: list[dict] = []
    skipped: list[dict] = []
    seen_codes: set[str] = set()

    for raw in load_rows(xlsx_path):
        source_ref = cell_text(raw[COL_CODE])
        name_de = cell_text(raw[COL_DE])
        name_en = cell_text(raw[COL_EN])
        kcal = parse_amount(raw[COL_KCAL])
        if not source_ref:
            skipped.append(
                {
                    "source_ref": "",
                    "name_de": name_de,
                    "name_en": name_en,
                    "reason": "missing_bls_code",
                    "kcal": "" if kcal is None else format_number(kcal),
                }
            )
            continue
        if source_ref in seen_codes:
            skipped.append(
                {
                    "source_ref": source_ref,
                    "name_de": name_de,
                    "name_en": name_en,
                    "reason": "duplicate_bls_code",
                    "kcal": "" if kcal is None else format_number(kcal),
                }
            )
            continue
        seen_codes.add(source_ref)
        if kcal is None:
            skipped.append(
                {
                    "source_ref": source_ref,
                    "name_de": name_de,
                    "name_en": name_en,
                    "reason": "missing_kcal",
                    "kcal": "",
                }
            )
            continue
        display_name = name_en or name_de
        kept.append(
            {
                "source_ref": source_ref,
                "name": display_name,
                "name_de": name_de,
                "bls_group": source_ref[0],
                "kcal": kcal,
                "protein": parse_amount(raw[COL_PROTEIN]),
                "fat": parse_amount(raw[COL_FAT]),
                "carbs": parse_amount(raw[COL_CARBS]),
                "fiber": parse_amount(raw[COL_FIBER]),
                "sugar": parse_amount(raw[COL_SUGAR]),
                "sodium_mg": parse_amount(raw[COL_SODIUM]),
            }
        )

    kept.sort(key=lambda row: row["source_ref"])
    collisions = assign_slugs(kept)

    with SKIPPED_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["source_ref", "name_de", "name_en", "reason", "kcal"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(skipped)

    with COLLISIONS_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["base_slug", "source_ref", "name", "name_de", "final_slug"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(collisions)

    with IMPORT_CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for record in kept:
            writer.writerow(to_import_row(record))

    return {
        "kept": len(kept),
        "skipped": len(skipped),
        "skipped_missing_kcal": sum(1 for row in skipped if row["reason"] == "missing_kcal"),
        "slug_collision_rows": len(collisions),
        "slug_collision_groups": len({row["base_slug"] for row in collisions}),
        "csv_bytes": IMPORT_CSV_PATH.stat().st_size,
        "samples": random.sample(kept, min(10, len(kept))),
    }


def print_report(stats: dict) -> None:
    print(f"kept: {stats['kept']}")
    print(f"skipped: {stats['skipped']} (missing_kcal={stats['skipped_missing_kcal']})")
    print(
        f"slug collisions: {stats['slug_collision_rows']} rows "
        f"in {stats['slug_collision_groups']} groups"
    )
    print(f"csv: {IMPORT_CSV_PATH} ({stats['csv_bytes']} bytes)")
    print("10 random rows:")
    for record in stats["samples"]:
        print(
            f"  {record['slug']} | {record['name']!r} | de={record['name_de']!r} | "
            f"kcal={record['kcal']} group={record['bls_group']} "
            f"ref={record['source_ref']}"
        )


if __name__ == "__main__":
    try:
        print_report(build())
    except Exception as exc:
        print(f"build failed: {exc}", file=sys.stderr)
        raise
