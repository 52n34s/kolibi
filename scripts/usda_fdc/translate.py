#!/usr/bin/env python3
"""Fill names.de / names.es on the USDA import CSV via Claude Haiku 4.5.

Does not write to Supabase and does not overwrite the source CSV.

    python3 scripts/usda_fdc/translate.py
"""

from __future__ import annotations

import csv
import json
import os
import random
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
INPUT_CSV = DATA_DIR / "foods_import_usda_fdc.csv"
OUTPUT_CSV = DATA_DIR / "foods_import_usda_fdc_translated.csv"
FAILURES_CSV = DATA_DIR / "translation_failures.csv"
UNCERTAIN_CSV = DATA_DIR / "translation_uncertain.csv"
CHECKPOINT_PATH = DATA_DIR / "translation_checkpoint.json"

# Documented Claude API alias for Haiku 4.5 (resolves to claude-haiku-4-5-20251001).
# https://platform.claude.com/docs/en/about-claude/models/overview
MODEL = "claude-haiku-4-5"
ANTHROPIC_VERSION = "2023-06-01"
BATCH_SIZE = 50
MAX_RETRIES = 2
TIMEOUT_S = 90

# Haiku 4.5, Claude API, USD / million tokens
# https://platform.claude.com/docs/en/about-claude/pricing
PRICE_INPUT = 1.00
PRICE_CACHE_WRITE_5M = 1.25
PRICE_CACHE_HIT = 0.10
PRICE_OUTPUT = 5.00

SYSTEM_PROMPT = """Du übersetzt Lebensmittel-Referenznamen aus einer Ernährungs-Datenbank ins Deutsche und Spanische, für eine App mit editierbarer Zutatenliste (Nutzer sehen den Namen beim Bestätigen einer Mahlzeit).
Regeln:
- Übersetze den Lebensmittel-Begriff selbst korrekt und alltagstauglich (nicht wörtlich) — 'Bell pepper' → 'Paprika', nicht 'Glockenpfeffer'.
- Markennamen (Großschreibung, Apostroph-S, z.B. 'MCDONALD'S') NIEMALS übersetzen, unverändert lassen, nur den beschreibenden Teil danach übersetzen.
- Halte die Übersetzung ähnlich knapp wie das Original (keine langen Erklärsätze).
- Falls ein Name mehrdeutig oder unsicher ist: übersetze so gut wie möglich, aber setze uncertain: true im Output für diesen Eintrag.
- Antworte NUR mit validem JSON, keine Erklärungen, kein Markdown.
- Output-Schema: JSON-Array von Objekten {index, de, es, uncertain: boolean}. index muss exakt dem Input-index entsprechen. de und es sind nicht-leere Strings."""


def load_api_key() -> str:
    key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    if key:
        return key
    for path in (ROOT / ".env.local", ROOT / ".env"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("#") or "=" not in stripped:
                continue
            name, value = stripped.split("=", 1)
            if name.strip() == "ANTHROPIC_API_KEY":
                key = value.strip().strip("'").strip('"')
                if key:
                    return key
    raise SystemExit(
        "ANTHROPIC_API_KEY is not set. Export it or add it to .env / .env.local."
    )


def parse_names(raw: str) -> dict:
    try:
        parsed = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}
    return {
        "en": parsed.get("en"),
        "de": parsed.get("de"),
        "es": parsed.get("es"),
    }


def dump_names(names: dict) -> str:
    return json.dumps(
        {"en": names.get("en"), "de": names.get("de"), "es": names.get("es")},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def extract_json_array(text: str) -> list:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start < 0 or end < 0 or end <= start:
        raise ValueError("no JSON array in model response")
    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, list):
        raise ValueError("model JSON is not an array")
    return parsed


def empty_usage() -> dict[str, int]:
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
    }


def add_usage(total: dict[str, int], usage: dict | None) -> None:
    if not usage:
        return
    total["input_tokens"] += int(usage.get("input_tokens") or 0)
    total["output_tokens"] += int(usage.get("output_tokens") or 0)
    total["cache_creation_input_tokens"] += int(usage.get("cache_creation_input_tokens") or 0)
    total["cache_read_input_tokens"] += int(usage.get("cache_read_input_tokens") or 0)


def estimate_cost_usd(usage: dict[str, int]) -> float:
    billed_input = max(
        0,
        usage["input_tokens"]
        - usage["cache_creation_input_tokens"]
        - usage["cache_read_input_tokens"],
    )
    return (
        billed_input / 1_000_000 * PRICE_INPUT
        + usage["cache_creation_input_tokens"] / 1_000_000 * PRICE_CACHE_WRITE_5M
        + usage["cache_read_input_tokens"] / 1_000_000 * PRICE_CACHE_HIT
        + usage["output_tokens"] / 1_000_000 * PRICE_OUTPUT
    )


def load_checkpoint() -> dict:
    if not CHECKPOINT_PATH.is_file():
        return {
            "completed_batches": [],
            "results": {},
            "failures": [],
            "usage": empty_usage(),
        }
    data = json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
    data.setdefault("completed_batches", [])
    data.setdefault("results", {})
    data.setdefault("failures", [])
    data.setdefault("usage", empty_usage())
    return data


def save_checkpoint(data: dict) -> None:
    CHECKPOINT_PATH.write_text(
        json.dumps(data, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def call_anthropic(api_key: str, user_payload: list[dict]) -> tuple[str, dict]:
    body = {
        "model": MODEL,
        "max_tokens": 16000,
        "temperature": 0,
        "system": [
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        "messages": [
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=False),
            }
        ],
    }
    request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_VERSION,
        },
        method="POST",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S, context=ctx) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail[:500]}") from exc
    if payload.get("type") == "error":
        message = payload.get("error", {}).get("message", "unknown Anthropic error")
        raise RuntimeError(message)
    text_parts = [
        block.get("text", "")
        for block in payload.get("content") or []
        if block.get("type") == "text"
    ]
    text = "\n".join(text_parts).strip()
    if not text:
        raise RuntimeError("empty model response")
    return text, payload.get("usage") or {}


def translate_batch(api_key: str, batch: list[dict]) -> tuple[list[dict], dict]:
    user_payload = [
        {"index": item["index"], "name": item["name"], "category": item["category"]}
        for item in batch
    ]
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            text, usage = call_anthropic(api_key, user_payload)
            parsed = extract_json_array(text)
            by_index: dict[int, dict] = {}
            for raw in parsed:
                if not isinstance(raw, dict):
                    continue
                try:
                    index = int(raw["index"])
                except (KeyError, TypeError, ValueError):
                    continue
                de = str(raw.get("de") or "").strip()
                es = str(raw.get("es") or "").strip()
                uncertain = bool(raw.get("uncertain"))
                if not de or not es:
                    continue
                by_index[index] = {"de": de, "es": es, "uncertain": uncertain}
            expected = {item["index"] for item in batch}
            if expected - by_index.keys():
                raise ValueError(
                    f"incomplete batch: got {len(by_index)}/{len(expected)} items"
                )
            ordered = [by_index[item["index"]] for item in batch]
            return ordered, usage
        except Exception as exc:  # noqa: BLE001 — retry then fall back
            last_error = exc
            if attempt < MAX_RETRIES:
                sleep_s = 2 ** (attempt + 1)
                if isinstance(exc, urllib.error.HTTPError) and exc.code == 429:
                    sleep_s = max(sleep_s, 10)
                print(f"  retry {attempt + 1}/{MAX_RETRIES} after {exc} (sleep {sleep_s}s)")
                time.sleep(sleep_s)
    raise RuntimeError(str(last_error) if last_error else "batch failed")


def write_outputs(rows: list[dict], checkpoint: dict) -> None:
    results = checkpoint["results"]
    fieldnames = list(rows[0].keys()) if rows else []
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for offset, row in enumerate(rows):
            updated = dict(row)
            names = parse_names(row.get("names") or "")
            english = (names.get("en") or row.get("name") or "").strip()
            result = results.get(str(offset))
            if result:
                names["de"] = result["de"]
                names["es"] = result["es"]
            else:
                names["de"] = english
                names["es"] = english
            updated["names"] = dump_names(names)
            writer.writerow(updated)

    with FAILURES_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["row_index", "source_ref", "name", "category", "reason"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(checkpoint["failures"])

    uncertain_rows = []
    for offset, row in enumerate(rows):
        result = results.get(str(offset))
        if not result or not result.get("uncertain"):
            continue
        names = parse_names(row.get("names") or "")
        uncertain_rows.append(
            {
                "row_index": offset,
                "source_ref": row.get("source_ref", ""),
                "en": names.get("en") or row.get("name") or "",
                "de": result["de"],
                "es": result["es"],
                "category": row.get("category", ""),
            }
        )
    with UNCERTAIN_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["row_index", "source_ref", "en", "de", "es", "category"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(uncertain_rows)


def print_report(rows: list[dict], checkpoint: dict) -> None:
    results = checkpoint["results"]
    translated = sum(1 for key in results if int(key) < len(rows))
    fallbacks = len(checkpoint["failures"])
    uncertain = sum(1 for item in results.values() if item.get("uncertain"))
    usage = checkpoint["usage"]
    cost = estimate_cost_usd(usage)
    print(f"translated: {translated}/{len(rows)}")
    print(f"failures/fallbacks: {fallbacks} -> {FAILURES_CSV}")
    print(f"uncertain: {uncertain} -> {UNCERTAIN_CSV}")
    print(
        "tokens: "
        f"input={usage['input_tokens']} "
        f"cache_write={usage['cache_creation_input_tokens']} "
        f"cache_read={usage['cache_read_input_tokens']} "
        f"output={usage['output_tokens']}"
    )
    print(
        f"estimated cost: ${cost:.4f} "
        "(Haiku 4.5 $1/$5 per MTok; cache $1.25 write / $0.10 hit)"
    )
    print(f"output: {OUTPUT_CSV}")

    sample_idxs = random.sample(range(len(rows)), min(15, len(rows)))
    print("15 random rows (en / de / es):")
    for idx in sample_idxs:
        row = rows[idx]
        names = parse_names(row.get("names") or "")
        result = results.get(str(idx), {})
        en = names.get("en") or row.get("name") or ""
        de = result.get("de") or en
        es = result.get("es") or en
        flag = " uncertain" if result.get("uncertain") else ""
        print(f"  [{idx}]{flag}")
        print(f"    en: {en}")
        print(f"    de: {de}")
        print(f"    es: {es}")


def main() -> None:
    api_key = load_api_key()
    if not INPUT_CSV.is_file():
        raise SystemExit(f"missing input CSV: {INPUT_CSV}")

    with INPUT_CSV.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    checkpoint = load_checkpoint()
    completed = set(checkpoint["completed_batches"])
    total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"model={MODEL} rows={len(rows)} batches={total_batches} resume={len(completed)}")

    for batch_id in range(total_batches):
        if batch_id in completed:
            continue
        start = batch_id * BATCH_SIZE
        end = min(start + BATCH_SIZE, len(rows))
        batch = []
        for offset, row in enumerate(rows[start:end], start=start):
            names = parse_names(row.get("names") or "")
            english = (names.get("en") or row.get("name") or "").strip()
            batch.append(
                {
                    "index": offset - start,
                    "row_index": offset,
                    "name": english,
                    "category": row.get("category") or "",
                    "source_ref": row.get("source_ref") or "",
                }
            )
        print(f"batch {batch_id + 1}/{total_batches} rows {start}-{end - 1}")
        try:
            translations, usage = translate_batch(api_key, batch)
            add_usage(checkpoint["usage"], usage)
            for item, translated in zip(batch, translations):
                checkpoint["results"][str(item["row_index"])] = translated
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED: {exc}")
            for item in batch:
                english = item["name"]
                checkpoint["results"][str(item["row_index"])] = {
                    "de": english,
                    "es": english,
                    "uncertain": False,
                    "fallback": True,
                }
                checkpoint["failures"].append(
                    {
                        "row_index": item["row_index"],
                        "source_ref": item["source_ref"],
                        "name": english,
                        "category": item["category"],
                        "reason": str(exc),
                    }
                )
        completed.add(batch_id)
        checkpoint["completed_batches"] = sorted(completed)
        save_checkpoint(checkpoint)

    write_outputs(rows, checkpoint)
    print_report(rows, checkpoint)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("interrupted; checkpoint saved, rerun to resume", file=sys.stderr)
        sys.exit(130)
