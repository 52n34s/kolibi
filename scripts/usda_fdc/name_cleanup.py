"""Rule-based USDA description cleanup (English only, no LLM).

USDA names are often inverted: "Apples, raw, with skin".
Only rewrite when the pattern is unambiguous. Otherwise keep the original.
"""

from __future__ import annotations

import re

# USDA SR shorthand — if present, do not rewrite (too compressed to invert safely).
_USDA_SHORTHAND = re.compile(
    r"\b(?:CKD|BLD|ENR|RSTD|BKD|DRND|FRZ|CND|SWT|GRN|WHL|LN|BNLESS|BNLES|"
    r"COMMLY|PREP|MXD|MST|REG|W/|WO/)\b",
    re.IGNORECASE,
)

# Single-token cooking/form states that can safely move in front of the food.
_PREP_WORDS = frozenset(
    {
        "raw",
        "cooked",
        "boiled",
        "steamed",
        "baked",
        "roasted",
        "grilled",
        "fried",
        "canned",
        "frozen",
        "dried",
        "fresh",
        "smoked",
        "pickled",
        "toasted",
        "braised",
        "broiled",
        "poached",
        "blanched",
        "dehydrated",
        "unprepared",
        "unsweetened",
    }
)

_FOOD_HEAD = re.compile(r"^[A-Za-z][A-Za-z0-9 \-']{0,48}$")
_SAFE_TRAILER = re.compile(
    r"^(with |without |in |on |no |from |including )",
    re.IGNORECASE,
)


def _sentence_case(text: str) -> str:
    if not text:
        return text
    return text[0].upper() + text[1:]


def cleanup_usda_description(description: str) -> str:
    """Return a more natural English name, or the original if unsure."""
    original = description.strip()
    if not original or "," not in original:
        return original
    if _USDA_SHORTHAND.search(original):
        return original

    parts = [part.strip() for part in original.split(",")]
    if any(not part for part in parts):
        return original
    if len(parts) not in (2, 3):
        return original

    head, prep, *rest = parts
    if not _FOOD_HEAD.match(head):
        return original
    if prep.casefold() not in _PREP_WORDS:
        return original

    trailer = rest[0] if rest else None
    if trailer is not None and not _SAFE_TRAILER.match(trailer):
        return original

    food = head
    bits = [prep.casefold(), food]
    if trailer:
        bits.append(trailer)
    return _sentence_case(" ".join(bits))
