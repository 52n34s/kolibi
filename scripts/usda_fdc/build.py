#!/usr/bin/env python3
"""Parse USDA FDC CSVs, clean names, and write the local foods import CSV.

Does not write to Supabase. Run after (or with) download.py:

    python3 scripts/usda_fdc/download.py
    python3 scripts/usda_fdc/build.py
"""

from __future__ import annotations

import csv
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from categories import normalize_category
from download import RAW_DIR, download_all
from kolibi_fold import kolibi_fold, kolibi_slug
from name_cleanup import cleanup_usda_description

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
INTERMEDIATE_PATH = DATA_DIR / "intermediate_usda.json"
SKIPPED_PATH = DATA_DIR / "skipped_no_kcal.csv"
COLLISIONS_PATH = DATA_DIR / "slug_collisions.csv"
IMPORT_CSV_PATH = DATA_DIR / "foods_import_usda_fdc.csv"

DATASETS = (
    {
        "key": "sr_legacy",
        "raw_dir": RAW_DIR / "sr_legacy",
        "id_table": "sr_legacy_food.csv",
        "data_type": "sr_legacy_food",
    },
    {
        "key": "foundation",
        "raw_dir": RAW_DIR / "foundation",
        "id_table": "foundation_food.csv",
        "data_type": "foundation_food",
    },
)

# Prefer true Energy-kcal (1008). Never take kJ (1062).
# Foundation Foods often only publish Atwater kcal (2048/2047).
ENERGY_KCAL_IDS = ("1008", "2048", "2047")
PROTEIN_ID = "1003"
FAT_ID = "1004"
CARBS_ID = "1005"
FIBER_ID = "1079"
SUGAR_IDS = ("2000", "1063")
SODIUM_ID = "1093"

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
    "is_verified",
    "names",
    "search_terms",
    "usda_ndb",
    "slug",
    "source_desc",
]

SOURCE = "usda_fdc"
SOURCE_DESC_DEFAULT = "USDA FoodData Central"
SOURCE_DESC_FAST_FOODS = (
    "USDA SR Legacy, Stand 2018 – kann von aktueller Rezeptur abweichen"
)
USDA_FAST_FOODS_CATEGORY_ID = "21"


def find_csv(root: Path, filename: str) -> Path:
    matches = list(root.rglob(filename))
    if not matches:
        raise FileNotFoundError(f"{filename} not found under {root}")
    return min(matches, key=lambda path: len(path.parts))


def parse_amount(raw: str | None) -> float | None:
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    if value != value:  # NaN
        return None
    return value


def pick_energy_kcal(nutrients: dict[str, float]) -> tuple[float | None, str | None]:
    for nutrient_id in ENERGY_KCAL_IDS:
        if nutrient_id in nutrients:
            return nutrients[nutrient_id], nutrient_id
    return None, None


def pick_sugar(nutrients: dict[str, float]) -> float | None:
    for nutrient_id in SUGAR_IDS:
        if nutrient_id in nutrients:
            return nutrients[nutrient_id]
    return None


def load_table(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def index_by_fdc(rows: list[dict[str, str]], key: str = "fdc_id") -> dict[str, dict[str, str]]:
    return {row[key]: row for row in rows if row.get(key)}


def load_nutrients(path: Path, wanted_ids: set[str], allowed_fdc: set[str]) -> dict[str, dict[str, float]]:
    by_food: dict[str, dict[str, float]] = defaultdict(dict)
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            fdc_id = row.get("fdc_id", "")
            nutrient_id = row.get("nutrient_id", "")
            if fdc_id not in allowed_fdc or nutrient_id not in wanted_ids:
                continue
            amount = parse_amount(row.get("amount"))
            if amount is None:
                continue
            # First value wins; food_nutrient should be unique per (fdc, nutrient).
            by_food[fdc_id].setdefault(nutrient_id, amount)
    return by_food


def parse_dataset(spec: dict[str, str]) -> tuple[list[dict], list[dict]]:
    raw_dir = spec["raw_dir"]
    food_rows = load_table(find_csv(raw_dir, "food.csv"))
    category_rows = load_table(find_csv(raw_dir, "food_category.csv"))
    id_rows = load_table(find_csv(raw_dir, spec["id_table"]))
    categories = {row["id"]: row["description"] for row in category_rows}
    ndb_by_fdc = {row["fdc_id"]: (row.get("NDB_number") or "").strip() for row in id_rows}

    foods = [
        row
        for row in food_rows
        if row.get("data_type") == spec["data_type"]
    ]
    allowed = {row["fdc_id"] for row in foods}
    wanted_ids = set(ENERGY_KCAL_IDS) | {PROTEIN_ID, FAT_ID, CARBS_ID, FIBER_ID, SODIUM_ID} | set(SUGAR_IDS)
    nutrients = load_nutrients(find_csv(raw_dir, "food_nutrient.csv"), wanted_ids, allowed)

    kept: list[dict] = []
    skipped: list[dict] = []

    for row in foods:
        fdc_id = row["fdc_id"]
        description = (row.get("description") or "").strip()
        food_nutrients = nutrients.get(fdc_id, {})
        kcal, energy_id = pick_energy_kcal(food_nutrients)
        food_category_id = (row.get("food_category_id") or "").strip()
        usda_category = categories.get(food_category_id)

        if not description:
            skipped.append(
                {
                    "fdcId": fdc_id,
                    "dataset": spec["key"],
                    "description": description,
                    "reason": "missing_description",
                    "kcal": "" if kcal is None else kcal,
                }
            )
            continue

        if kcal is None:
            skipped.append(
                {
                    "fdcId": fdc_id,
                    "dataset": spec["key"],
                    "description": description,
                    "reason": "missing_kcal",
                    "kcal": "",
                }
            )
            continue

        if kcal < 0:
            skipped.append(
                {
                    "fdcId": fdc_id,
                    "dataset": spec["key"],
                    "description": description,
                    "reason": "negative_kcal",
                    "kcal": kcal,
                }
            )
            continue

        # 0 kcal is valid (water, diet soda, salt). Do not drop it.

        ndb = ndb_by_fdc.get(fdc_id) or None
        kept.append(
            {
                "fdcId": int(fdc_id),
                "ndbNumber": ndb,
                "description": description,
                "foodCategory": usda_category,
                "foodCategoryId": food_category_id,
                "dataset": spec["key"],
                "energyNutrientId": int(energy_id) if energy_id else None,
                "kcal": kcal,
                "protein": food_nutrients.get(PROTEIN_ID),
                "fat": food_nutrients.get(FAT_ID),
                "carbs": food_nutrients.get(CARBS_ID),
                "fiber": food_nutrients.get(FIBER_ID),
                "sugar": pick_sugar(food_nutrients),
                "sodiumMg": food_nutrients.get(SODIUM_ID),
            }
        )

    return kept, skipped


def format_number(value: float | None) -> str:
    if value is None:
        return ""
    if value == int(value):
        return str(int(value))
    text = f"{value:.4f}".rstrip("0").rstrip(".")
    return text


def write_skipped(rows: list[dict]) -> None:
    with SKIPPED_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["fdcId", "dataset", "description", "reason", "kcal"],
        )
        writer.writeheader()
        writer.writerows(rows)


def assign_slugs(records: list[dict]) -> list[dict]:
    collisions: list[dict] = []
    grouped: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        base = kolibi_slug(record["name"]) or f"food_{record['fdcId']}"
        record["_base_slug"] = base
        grouped[base].append(record)

    for base, items in grouped.items():
        if len(items) == 1:
            items[0]["slug"] = base
            continue
        for item in items:
            slug = f"{base}_{item['fdcId']}"
            item["slug"] = slug
            collisions.append(
                {
                    "base_slug": base,
                    "fdcId": item["fdcId"],
                    "dataset": item["dataset"],
                    "name": item["name"],
                    "final_slug": slug,
                }
            )
    return collisions


def to_import_row(record: dict) -> dict[str, str]:
    names = {"en": record["name"], "de": None, "es": None}
    return {
        "name": record["name"],
        "name_normalized": kolibi_fold(record["name"]),
        "source": SOURCE,
        "source_ref": str(record["fdcId"]),
        "kcal_per_100g": format_number(record["kcal"]),
        # TODO: empty protein/fat/carbs must become 0 in SQL INSERTs, not NULL
        # (explicit NULL bypasses the foods table default of 0). Only salt was
        # missing all three in the FDC import; fiber/sugar may stay empty/NULL.
        "protein_per_100g": format_number(record["protein"]),
        "carbs_per_100g": format_number(record["carbs"]),
        "fat_per_100g": format_number(record["fat"]),
        "fiber_per_100g": format_number(record["fiber"]),
        "sugar_per_100g": format_number(record["sugar"]),
        "sodium_mg_per_100g": format_number(record["sodiumMg"]),
        "is_countable": "false",
        "category": record["category"],
        "is_verified": "true",
        "names": json.dumps(names, ensure_ascii=False, separators=(",", ":")),
        "search_terms": "[]",
        "usda_ndb": record["ndbNumber"] or "",
        "slug": record["slug"],
        "source_desc": source_desc_for(record),
    }


def source_desc_for(record: dict) -> str:
    if str(record.get("foodCategoryId") or "") == USDA_FAST_FOODS_CATEGORY_ID:
        return SOURCE_DESC_FAST_FOODS
    return SOURCE_DESC_DEFAULT


def build() -> dict:
    download_all()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    kept: list[dict] = []
    skipped: list[dict] = []
    seen_fdc: set[int] = set()

    for spec in DATASETS:
        dataset_kept, dataset_skipped = parse_dataset(spec)
        skipped.extend(dataset_skipped)
        for record in dataset_kept:
            if record["fdcId"] in seen_fdc:
                skipped.append(
                    {
                        "fdcId": record["fdcId"],
                        "dataset": record["dataset"],
                        "description": record["description"],
                        "reason": "duplicate_fdc_id",
                        "kcal": record["kcal"],
                    }
                )
                continue
            seen_fdc.add(record["fdcId"])
            kept.append(record)

    kept.sort(key=lambda row: row["fdcId"])
    INTERMEDIATE_PATH.write_text(
        json.dumps(kept, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_skipped(skipped)

    import_records = []
    for row in kept:
        name = cleanup_usda_description(row["description"])
        import_records.append(
            {
                **row,
                "name": name,
                "category": normalize_category(row.get("foodCategory"), row["description"]),
            }
        )

    collisions = assign_slugs(import_records)
    with COLLISIONS_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["base_slug", "fdcId", "dataset", "name", "final_slug"],
        )
        writer.writeheader()
        writer.writerows(collisions)

    with IMPORT_CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for record in import_records:
            writer.writerow(to_import_row(record))

    colliding_groups = len({row["base_slug"] for row in collisions})
    fast_foods_hint = sum(
        1
        for record in import_records
        if str(record.get("foodCategoryId") or "") == USDA_FAST_FOODS_CATEGORY_ID
    )
    return {
        "kept": len(import_records),
        "skipped": len(skipped),
        "skipped_missing_kcal": sum(1 for row in skipped if row["reason"] == "missing_kcal"),
        "slug_collision_rows": len(collisions),
        "slug_collision_groups": colliding_groups,
        "fast_foods_source_desc": fast_foods_hint,
        "csv_bytes": IMPORT_CSV_PATH.stat().st_size,
        "samples": random.sample(import_records, min(10, len(import_records))),
    }


def print_report(stats: dict) -> None:
    print(f"kept: {stats['kept']}")
    print(f"skipped: {stats['skipped']} (missing_kcal={stats['skipped_missing_kcal']})")
    print(
        f"slug collisions: {stats['slug_collision_rows']} rows "
        f"in {stats['slug_collision_groups']} groups"
    )
    print(f"fast-foods source_desc: {stats['fast_foods_source_desc']}")
    print(f"csv: {IMPORT_CSV_PATH} ({stats['csv_bytes']} bytes)")
    print("10 random rows:")
    for record in stats["samples"]:
        print(
            f"  {record['slug']} | {record['name']!r} | "
            f"kcal={record['kcal']} cat={record['category']} "
            f"fdc={record['fdcId']} ndb={record['ndbNumber']}"
        )


if __name__ == "__main__":
    try:
        print_report(build())
    except Exception as exc:
        print(f"build failed: {exc}", file=sys.stderr)
        raise
