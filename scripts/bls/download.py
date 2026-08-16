#!/usr/bin/env python3
"""Download Bundeslebensmittelschlüssel 4.0 (MRI 2025, CC BY 4.0).

Saves the zip and extracted xlsx under ./data/raw/bls/. Does not touch the DB.
"""

from __future__ import annotations

import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw" / "bls"

ZIP_URL = "https://www.blsdb.de/assets/uploads/BLS_4_0_2025_DE.zip"
ZIP_NAME = "BLS_4_0_2025_DE.zip"
DATA_XLSX_NAME = "BLS_4_0_Daten_2025_DE.xlsx"
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
                print(
                    f"\r  {copied / 1_000_000:.1f}/{total_n / 1_000_000:.1f} MB ({pct:.0f}%)",
                    end="",
                    flush=True,
                )
            else:
                print(f"\r  {copied / 1_000_000:.1f} MB", end="", flush=True)
    print()
    tmp.replace(dest)


def _extract(zip_path: Path, extract_dir: Path) -> None:
    extract_dir.mkdir(parents=True, exist_ok=True)
    marker = extract_dir / ".extracted"
    if marker.exists() and data_xlsx_path(extract_dir).is_file():
        print(f"skip extract (exists): {extract_dir.name}")
        return
    print(f"extracting {zip_path.name} -> {extract_dir}")
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(extract_dir)
    marker.write_text("ok\n", encoding="utf-8")


def data_xlsx_path(extract_dir: Path | None = None) -> Path:
    root = extract_dir or RAW_DIR
    matches = list(root.rglob(DATA_XLSX_NAME))
    if not matches:
        return root / DATA_XLSX_NAME
    return min(matches, key=lambda path: len(path.parts))


def download_all() -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RAW_DIR / ZIP_NAME
    _download(ZIP_URL, zip_path)
    _extract(zip_path, RAW_DIR)
    xlsx = data_xlsx_path(RAW_DIR)
    if not xlsx.is_file():
        raise FileNotFoundError(f"missing {DATA_XLSX_NAME} under {RAW_DIR}")
    print(f"ready: {xlsx}")
    return xlsx


if __name__ == "__main__":
    try:
        download_all()
    except Exception as exc:
        print(f"download failed: {exc}", file=sys.stderr)
        raise
