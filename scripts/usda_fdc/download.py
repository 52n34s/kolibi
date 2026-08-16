#!/usr/bin/env python3
"""Download USDA FoodData Central bulk CSVs (SR Legacy + Foundation Foods).

Saves zip archives and extracted CSVs under ./data/raw/. Does not touch the DB.
"""

from __future__ import annotations

import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"

DATASETS = {
    "sr_legacy": {
        "url": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip",
        "zip_name": "FoodData_Central_sr_legacy_food_csv_2018-04.zip",
        "extract_dir": "sr_legacy",
    },
    "foundation": {
        "url": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip",
        "zip_name": "FoodData_Central_foundation_food_csv_2026-04-30.zip",
        "extract_dir": "foundation",
    },
}

USER_AGENT = "KolibiFoodImport/1.0 (local bulk download; not an API client)"


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"skip download (exists): {dest.name} ({dest.stat().st_size} bytes)")
        return

    tmp = dest.with_suffix(dest.suffix + ".partial")
    print(f"downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req) as resp, tmp.open("wb") as out:
        total = resp.headers.get("Content-Length")
        total_n = int(total) if total and total.isdigit() else None
        copied = 0
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            out.write(chunk)
            copied += len(chunk)
            if total_n:
                pct = 100.0 * copied / total_n
                print(f"\r  {copied / 1_000_000:.1f}/{total_n / 1_000_000:.1f} MB ({pct:.0f}%)", end="", flush=True)
            else:
                print(f"\r  {copied / 1_000_000:.1f} MB", end="", flush=True)
    print()
    tmp.replace(dest)


def _extract(zip_path: Path, extract_dir: Path) -> None:
    extract_dir.mkdir(parents=True, exist_ok=True)
    marker = extract_dir / ".extracted"
    if marker.exists():
        print(f"skip extract (exists): {extract_dir.name}")
        return
    print(f"extracting {zip_path.name} -> {extract_dir}")
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(extract_dir)
    marker.write_text("ok\n", encoding="utf-8")


def download_all() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for key, spec in DATASETS.items():
        zip_path = RAW_DIR / spec["zip_name"]
        _download(spec["url"], zip_path)
        _extract(zip_path, RAW_DIR / spec["extract_dir"])
        print(f"ready: {key}")


if __name__ == "__main__":
    try:
        download_all()
    except Exception as exc:
        print(f"download failed: {exc}", file=sys.stderr)
        sys.exit(1)
