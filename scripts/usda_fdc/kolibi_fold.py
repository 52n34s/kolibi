"""Fold / slug helpers for the USDA foods import.

`kolibi_fold` is NOT defined in any repo migration (resolve_foods / search_foods
SQL was applied out-of-band). This implementation is a conservative stand-in
aligned with:

- client `normalizeFoodName`: trim + lower
- typical Postgres `lower(unaccent(...))` matching
- existing curated slugs: `[a-z0-9_]+` only (`white_rice`, `reduced_fat_milk_2`)

name_normalized = kolibi_fold(display_name)   # spaces
slug            = kolibi_fold(display_name) with spaces → underscores
"""

from __future__ import annotations

import re
import unicodedata

_APOSTROPHES = dict.fromkeys(map(ord, "'ʼ’`´"), None)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def kolibi_fold(text: str) -> str:
    if not text:
        return ""
    stripped = text.translate(_APOSTROPHES)
    decomposed = unicodedata.normalize("NFKD", stripped)
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    lowered = without_marks.casefold().replace("ß", "ss")
    return " ".join(_NON_ALNUM.sub(" ", lowered).split())


def kolibi_slug(text: str) -> str:
    folded = kolibi_fold(text)
    return folded.replace(" ", "_") if folded else ""
