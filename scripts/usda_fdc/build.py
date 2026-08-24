#!/usr/bin/env python3
"""Parse USDA FDC CSVs, clean names, write import CSV + SQL.

Does not write to Supabase. Run after (or with) download.py:

    python3 scripts/usda_fdc/download.py
    python3 scripts/usda_fdc/build.py
"""

from __future__ import annotations

import csv
import json
import random
import re
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

# Optional micronutrients / lipids — missing → blank CSV → SQL NULL (never 0).
MICRO_NUTRIENT_IDS: dict[str, str] = {
    "1089": "iron_mg_per_100g",
    "1087": "calcium_mg_per_100g",
    "1095": "zinc_mg_per_100g",
    "1090": "magnesium_mg_per_100g",
    "1092": "potassium_mg_per_100g",
    "1100": "iodine_ug_per_100g",
    "1178": "vitamin_b12_ug_per_100g",
    "1177": "folate_ug_per_100g",
    "1114": "vitamin_d_ug_per_100g",
    "1258": "saturated_fat_per_100g",
    "1292": "monounsaturated_fat_per_100g",
    "1293": "polyunsaturated_fat_per_100g",
    "1404": "omega3_ala_per_100g",
    "1253": "cholesterol_mg_per_100g",
}
MICRO_COLUMNS = list(MICRO_NUTRIENT_IDS.values())

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
    *MICRO_COLUMNS,
    "is_countable",
    "category",
    "is_verified",
    "names",
    "search_terms",
    "usda_ndb",
    "slug",
    "source_desc",
]

TRANSLATED_CSV_PATH = DATA_DIR / "foods_import_usda_fdc_translated.csv"
EXISTING_NDB_PATH = DATA_DIR / "existing_usda_ndb.csv"
IMPORT_SQL_PATH = DATA_DIR / "import_usda_fdc.sql"
NULLED_NDB_PATH = DATA_DIR / "usda_ndb_nulled.csv"
SEED_SQL = ROOT / "supabase" / "migrations" / "0008_seed_foods_v3.sql"
BLS_TRANSLATED_CSV = DATA_DIR / "bls_import_translated.csv"
SQL_BATCH_SIZE = 500

NUTRIENT_MERGE_COLUMNS = [
    "kcal_per_100g",
    "protein_per_100g",
    "carbs_per_100g",
    "fat_per_100g",
    "fiber_per_100g",
    "sugar_per_100g",
    "sodium_mg_per_100g",
    *MICRO_COLUMNS,
]

SQL_COLUMNS = [
    "name",
    "name_normalized",
    "names",
    "search_terms",
    "kcal_per_100g",
    "protein_per_100g",
    "fat_per_100g",
    "carbs_per_100g",
    "fiber_per_100g",
    "sugar_per_100g",
    "sodium_mg_per_100g",
    *MICRO_COLUMNS,
    "is_countable",
    "category",
    "source",
    "source_ref",
    "source_desc",
    "usda_ndb",
    "slug",
    "is_verified",
    "created_by",
]
SQL_UPDATE_COLS = [c for c in SQL_COLUMNS if c not in ("source", "source_ref")]

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
    wanted_ids = (
        set(ENERGY_KCAL_IDS)
        | {PROTEIN_ID, FAT_ID, CARBS_ID, FIBER_ID, SODIUM_ID}
        | set(SUGAR_IDS)
        | set(MICRO_NUTRIENT_IDS)
    )
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
        micros = {
            col: food_nutrients.get(nid) for nid, col in MICRO_NUTRIENT_IDS.items()
        }
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
                **micros,
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


def format_zero(value: float | None) -> str:
    """Missing required macros → 0, never a blank that becomes SQL NULL."""
    return format_number(0.0 if value is None else value)


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
        # protein/fat/carbs are NOT NULL DEFAULT 0 — missing must be 0, not NULL.
        # fiber/sugar/sodium/micros stay blank → SQL NULL when unknown.
        "protein_per_100g": format_zero(record["protein"]),
        "carbs_per_100g": format_zero(record["carbs"]),
        "fat_per_100g": format_zero(record["fat"]),
        "fiber_per_100g": format_number(record["fiber"]),
        "sugar_per_100g": format_number(record["sugar"]),
        "sodium_mg_per_100g": format_number(record["sodiumMg"]),
        **{col: format_number(record.get(col)) for col in MICRO_COLUMNS},
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


def ndb_key(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    return text.lstrip("0") or "0"


def sql_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_text(value: str | None) -> str:
    if value is None:
        return "NULL"
    text = value.strip() if isinstance(value, str) else str(value)
    if text == "":
        return "NULL"
    return sql_str(text)


def sql_num(raw: str | None, zero_if_empty: bool = False) -> str:
    """Blank → NULL by default; set zero_if_empty for NOT NULL macros."""
    text = (raw or "").strip()
    if not text:
        return "0" if zero_if_empty else "NULL"
    float(text)
    return text


def sql_bool(raw: str | None, default: bool) -> str:
    text = (raw or "").strip().lower()
    if text in ("true", "t", "1", "yes"):
        return "true"
    if text in ("false", "f", "0", "no"):
        return "false"
    return "true" if default else "false"


def parse_names(raw: str) -> dict[str, str]:
    try:
        parsed = json.loads(raw or "{}")
    except json.JSONDecodeError:
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}
    out: dict[str, str] = {}
    for key in ("en", "de", "es"):
        val = parsed.get(key)
        out[key] = val.strip() if isinstance(val, str) else ""
    return out


def build_search_terms(names: dict[str, str]) -> list[str]:
    seen: set[str] = set()
    terms: list[str] = []
    for key in ("en", "de", "es"):
        folded = kolibi_fold(names.get(key) or "")
        words = folded.split()
        short_food = bool(words) and all(len(w) < 3 for w in words)
        for word in words:
            if len(word) < 3 and not short_food:
                continue
            if word in seen:
                continue
            seen.add(word)
            terms.append(word)
    return terms


def sql_text_array(terms: list[str]) -> str:
    if not terms:
        return "ARRAY[]::text[]"
    inner = ", ".join(sql_str(t) for t in terms)
    return f"ARRAY[{inner}]::text[]"


def sql_names(names: dict[str, str]) -> str:
    payload = {"en": names["en"] or None, "de": names["de"] or None, "es": names["es"] or None}
    dumped = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return sql_str(dumped) + "::jsonb"


def merge_nutrients_into_translated() -> int:
    """Copy nutrient columns from fresh CSV into the translated CSV (keep names/slugs)."""
    if not TRANSLATED_CSV_PATH.is_file():
        raise FileNotFoundError(f"missing translated CSV: {TRANSLATED_CSV_PATH}")
    fresh_rows = list(csv.DictReader(IMPORT_CSV_PATH.open(encoding="utf-8", newline="")))
    by_ref = {row["source_ref"]: row for row in fresh_rows if row.get("source_ref")}
    translated = list(csv.DictReader(TRANSLATED_CSV_PATH.open(encoding="utf-8", newline="")))
    if not translated:
        raise SystemExit("translated CSV is empty")
    fieldnames = list(translated[0].keys())
    for col in NUTRIENT_MERGE_COLUMNS:
        if col not in fieldnames:
            # Insert micros after sodium_mg_per_100g when extending an older header.
            if "sodium_mg_per_100g" in fieldnames and col in MICRO_COLUMNS:
                idx = fieldnames.index("sodium_mg_per_100g") + 1
                while idx < len(fieldnames) and fieldnames[idx] in MICRO_COLUMNS:
                    idx += 1
                fieldnames.insert(idx, col)
            else:
                fieldnames.append(col)
    missing = 0
    for row in translated:
        src = by_ref.get(row.get("source_ref") or "")
        if not src:
            missing += 1
            continue
        for col in NUTRIENT_MERGE_COLUMNS:
            row[col] = src.get(col, "")
    if missing:
        raise SystemExit(f"translated rows missing from fresh CSV: {missing}")
    with TRANSLATED_CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(translated)
    return len(translated)


def tuple_sql(
    row: dict[str, str], names: dict[str, str], terms: list[str], usda_ndb: str | None
) -> str:
    values = {
        "name": sql_text(row.get("name") or names.get("en")),
        "name_normalized": sql_text(
            row.get("name_normalized") or kolibi_fold(names.get("en") or "")
        ),
        "names": sql_names(names),
        "search_terms": sql_text_array(terms),
        "kcal_per_100g": sql_num(row.get("kcal_per_100g")),
        "protein_per_100g": sql_num(row.get("protein_per_100g"), zero_if_empty=True),
        "fat_per_100g": sql_num(row.get("fat_per_100g"), zero_if_empty=True),
        "carbs_per_100g": sql_num(row.get("carbs_per_100g"), zero_if_empty=True),
        "fiber_per_100g": sql_num(row.get("fiber_per_100g")),
        "sugar_per_100g": sql_num(row.get("sugar_per_100g")),
        "sodium_mg_per_100g": sql_num(row.get("sodium_mg_per_100g")),
        **{col: sql_num(row.get(col)) for col in MICRO_COLUMNS},
        "is_countable": sql_bool(row.get("is_countable"), False),
        "category": sql_text(row.get("category")),
        "source": sql_text(row.get("source") or SOURCE),
        "source_ref": sql_text(row.get("source_ref")),
        "source_desc": sql_text(row.get("source_desc")),
        "usda_ndb": sql_text(usda_ndb),
        "slug": sql_text(row.get("slug")),
        "is_verified": "true",
        "created_by": "NULL",
    }
    inner = ",\n    ".join(values[c] for c in SQL_COLUMNS)
    return "  (\n    " + inner + "\n  )"


def chunks(items: list, size: int):
    for i in range(0, len(items), size):
        yield i // size + 1, items[i : i + size]


def load_seed_slug_owners() -> dict[str, tuple[str, str]]:
    text = SEED_SQL.read_text(encoding="utf-8")
    blocks = re.findall(
        r"VALUES \(\s*'([^']+)',\s*'((?:[^']|'')*)',.*?,\s*'(usda_sr28|bls_4_0)',\s*'([^']+)'",
        text,
        flags=re.S,
    )
    owners: dict[str, tuple[str, str]] = {}
    for slug, _name, source, ref in blocks:
        owners[slug] = (source, ref)
    return owners


def load_bls_slugs() -> set[str]:
    """Reserved slugs from the other import pipeline (mirrors BLS load_usda_slugs)."""
    if not BLS_TRANSLATED_CSV.is_file():
        return set()
    rows = list(csv.DictReader(BLS_TRANSLATED_CSV.open(encoding="utf-8")))
    slugs = {row["slug"] for row in rows if row.get("slug")}
    # BLS SQL renames these seed collisions to {base}_{source_ref}; reserve the
    # final forms (same pattern as BLS's remaps for dates_medjool/honey/tempeh).
    for old, new in (
        ("chia_seeds", "chia_seeds_H480100"),
        ("honey", "honey_S120000"),
        ("maple_syrup", "maple_syrup_S151100"),
        ("milk_chocolate", "milk_chocolate_S530000"),
        ("olive_oil", "olive_oil_Q120000"),
        ("orange_juice", "orange_juice_F603600"),
        ("peanut_butter", "peanut_butter_H880200"),
        ("sunflower_oil", "sunflower_oil_Q320000"),
        ("tofu", "tofu_H861000"),
    ):
        slugs.discard(old)
        slugs.add(new)
    return slugs


def assign_sql_slugs(
    records: list[dict], seed_owners: dict[str, tuple[str, str]], bls_slugs: set[str]
) -> dict:
    """Same collision rules as scripts/bls/build.py assign_sql_slugs (roles swapped)."""
    grouped: dict[str, list[dict]] = defaultdict(list)
    for rec in records:
        base = kolibi_slug(rec["name"]) or f"food_{rec['source_ref']}"
        rec["base_slug"] = base
        grouped[base].append(rec)

    internal_rows = 0
    internal_groups = 0
    for base, items in grouped.items():
        if len(items) == 1:
            items[0]["slug"] = base
            continue
        internal_groups += 1
        internal_rows += len(items)
        for item in items:
            item["slug"] = f"{base}_{item['source_ref']}"

    vs_seed = []
    vs_bls = []
    used: set[str] = set()
    for rec in records:
        slug = rec["slug"]
        owner = seed_owners.get(slug)
        # Seed usda_sr28 rows own their slug; FDC never matches those refs.
        own_seed = owner == ("usda_sr28", rec["source_ref"])
        collide_seed = owner is not None and not own_seed
        collide_bls = slug in bls_slugs
        if collide_seed or collide_bls:
            new_slug = f"{rec['base_slug']}_{rec['source_ref']}"
            if collide_seed:
                vs_seed.append((rec["source_ref"], rec["name"], slug, owner, new_slug))
            if collide_bls:
                vs_bls.append((rec["source_ref"], rec["name"], slug, new_slug))
            slug = new_slug
            rec["slug"] = slug
        if slug in used:
            raise SystemExit(f"duplicate USDA slug after fallback: {slug}")
        if slug in seed_owners or slug in bls_slugs:
            if not own_seed and slug not in {x[4] for x in vs_seed} and slug not in {
                x[3] for x in vs_bls
            }:
                if slug in seed_owners or slug in bls_slugs:
                    raise SystemExit(f"fallback slug still reserved: {slug}")
        used.add(slug)

    return {
        "internal_rows": internal_rows,
        "internal_groups": internal_groups,
        "vs_seed": vs_seed,
        "vs_bls": vs_bls,
        "own_seed_kept": sum(
            1
            for rec in records
            if seed_owners.get(rec["slug"]) == ("usda_sr28", rec["source_ref"])
        ),
    }


def write_import_sql() -> dict:
    existing_rows = list(
        csv.DictReader(EXISTING_NDB_PATH.open(encoding="utf-8-sig", newline=""))
    )
    existing_keys = {
        ndb_key(r.get("usda_ndb") or "")
        for r in existing_rows
        if ndb_key(r.get("usda_ndb") or "")
    }
    if "usda_ndb" not in (existing_rows[0].keys() if existing_rows else []):
        raise SystemExit(f"existing file missing usda_ndb column: {EXISTING_NDB_PATH}")

    rows = list(csv.DictReader(TRANSLATED_CSV_PATH.open(encoding="utf-8", newline="")))
    seed_owners = load_seed_slug_owners()
    bls_slugs = load_bls_slugs()

    seen_ndb: set[str] = set()
    records: list[dict] = []
    nulled = []
    reasons = {"intern_duplikat": 0, "kollidiert_mit_bestand": 0}

    for row in rows:
        names = parse_names(row.get("names") or "")
        if not names["en"]:
            names["en"] = (row.get("name") or "").strip()
        terms = build_search_terms(names)
        original = (row.get("usda_ndb") or "").strip()
        key = ndb_key(original)
        usda_ndb: str | None = original or None
        reason = None
        if key:
            if key in seen_ndb:
                usda_ndb = None
                reason = "intern_duplikat"
            elif key in existing_keys:
                usda_ndb = None
                reason = "kollidiert_mit_bestand"
            seen_ndb.add(key)
        if reason:
            reasons[reason] += 1
            nulled.append(
                {
                    "name": row.get("name") or names.get("en") or "",
                    "source_ref": row.get("source_ref") or "",
                    "usda_ndb": original,
                    "grund": reason,
                }
            )
        source_ref = (row.get("source_ref") or "").strip()
        records.append(
            {
                "row": row,
                "names": names,
                "name": names["en"],
                "terms": terms,
                "source_ref": source_ref,
                "usda_ndb": usda_ndb,
            }
        )

    slug_stats = assign_sql_slugs(records, seed_owners, bls_slugs)
    for rec in records:
        rec["row"] = {**rec["row"], "slug": rec["slug"]}

    with NULLED_NDB_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["name", "source_ref", "usda_ndb", "grund"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(nulled)

    n_batches = (len(records) + SQL_BATCH_SIZE - 1) // SQL_BATCH_SIZE
    full_batches = max(0, n_batches - 1)
    last_n = len(records) - full_batches * SQL_BATCH_SIZE
    col_sql = ",\n  ".join(SQL_COLUMNS)
    update_sql = ",\n  ".join(f"{c} = EXCLUDED.{c}" for c in SQL_UPDATE_COLS)
    header = f"""-- USDA FoodData Central import (SR Legacy + Foundation).
-- Generated from data/foods_import_usda_fdc_translated.csv
-- Rows: {len(records)} · Batches: {n_batches} ({full_batches} × {SQL_BATCH_SIZE}, last {last_n})
-- search_terms: unique kolibi_fold tokens from names.en/de/es;
--   tokens shorter than 3 chars dropped unless the whole name has no longer token.
-- sodium_mg_per_100g from CSV sodium_mg_per_100g.
-- micronutrients: blank CSV → SQL NULL (never 0).
-- usda_ndb: first occurrence only; NULL if already in existing_usda_ndb.csv
--   or if a later duplicate within this import.
-- slug: seed/BLS collisions renamed to {{base}}_{{source_ref}} (same as BLS).
-- ON CONFLICT matches foods_source_ref_unique (partial unique index).
-- Run via scripts/usda_fdc/run_import.py. This generator does not connect to the DB.

"""
    insert_head = f"""INSERT INTO public.foods (
  {col_sql}
) VALUES
"""
    conflict = f"""
ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL
DO UPDATE SET
  {update_sql};
"""

    with IMPORT_SQL_PATH.open("w", encoding="utf-8", newline="\n") as out:
        out.write(header)
        for batch_id, batch in chunks(records, SQL_BATCH_SIZE):
            start = (batch_id - 1) * SQL_BATCH_SIZE + 1
            end = start + len(batch) - 1
            out.write(f"-- batch {batch_id}/{n_batches} rows {start}-{end}\n")
            out.write(insert_head)
            out.write(
                ",\n".join(
                    tuple_sql(rec["row"], rec["names"], rec["terms"], rec["usda_ndb"])
                    for rec in batch
                )
            )
            out.write(conflict)
            out.write("\n")
        out.write("NOTIFY pgrst, 'reload schema';\n")

    return {
        "sql_rows": len(records),
        "sql_batches": n_batches,
        "sql_bytes": IMPORT_SQL_PATH.stat().st_size,
        "nulled_ndb": len(nulled),
        "slug_vs_seed": len(slug_stats["vs_seed"]),
        "slug_vs_bls": len(slug_stats["vs_bls"]),
        "slug_vs_seed_detail": slug_stats["vs_seed"],
        "slug_vs_bls_detail": slug_stats["vs_bls"],
    }


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

    translated_rows = merge_nutrients_into_translated()
    sql_stats = write_import_sql()

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
        "translated_rows": translated_rows,
        **sql_stats,
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
    print(f"translated: {TRANSLATED_CSV_PATH} ({stats['translated_rows']} rows)")
    print(
        f"sql: {IMPORT_SQL_PATH} ({stats['sql_bytes']} bytes, "
        f"{stats['sql_rows']} rows, {stats['sql_batches']} batches, "
        f"nulled_ndb={stats['nulled_ndb']})"
    )
    print(
        f"slug vs seed: {stats.get('slug_vs_seed', 0)} · "
        f"slug vs bls: {stats.get('slug_vs_bls', 0)}"
    )
    for item in stats.get("slug_vs_seed_detail") or []:
        print(f"  SEED {item}")
    for item in stats.get("slug_vs_bls_detail") or []:
        print(f"  BLS {item}")
    print("10 random rows:")
    for record in stats["samples"]:
        print(
            f"  {record['slug']} | {record['name']!r} | "
            f"kcal={record['kcal']} cat={record['category']} "
            f"fdc={record['fdcId']} ndb={record['ndbNumber']} "
            f"iron={record.get('iron_mg_per_100g')}"
        )


if __name__ == "__main__":
    try:
        print_report(build())
    except Exception as exc:
        print(f"build failed: {exc}", file=sys.stderr)
        raise
