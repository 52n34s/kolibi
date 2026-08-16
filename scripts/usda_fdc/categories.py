"""Map USDA food_category descriptions onto the existing Kolibi category set."""

from __future__ import annotations

import re

_EGG_HEAD = re.compile(r"\beggs?\b", re.IGNORECASE)

KOLIBI_CATEGORIES = frozenset(
    {
        "vegetable",
        "protein",
        "grain",
        "dairy",
        "fruit",
        "other",
        "legume",
        "nut",
        "beverage",
        "fat",
        "seed",
    }
)

_EXACT = {
    "dairy and egg products": "dairy",
    "spices and herbs": "other",
    "baby foods": "other",
    "fats and oils": "fat",
    "poultry products": "protein",
    "soups, sauces, and gravies": "other",
    "sausages and luncheon meats": "protein",
    "breakfast cereals": "grain",
    "fruits and fruit juices": "fruit",
    "pork products": "protein",
    "vegetables and vegetable products": "vegetable",
    "nut and seed products": "nut",
    "beef products": "protein",
    "beverages": "beverage",
    "finfish and shellfish products": "protein",
    "legumes and legume products": "legume",
    "lamb, veal, and game products": "protein",
    "baked products": "grain",
    "sweets": "other",
    "cereal grains and pasta": "grain",
    "fast foods": "other",
    "meals, entrees, and side dishes": "other",
    "snacks": "other",
    "american indian/alaska native foods": "other",
    "restaurant foods": "other",
}


def normalize_category(usda_category: str | None, description: str) -> str:
    raw = (usda_category or "").strip()
    key = raw.casefold()
    mapped = _EXACT.get(key, "other")
    desc = description.casefold()

    if key == "dairy and egg products" and _EGG_HEAD.search(desc.split(",")[0]):
        return "protein"

    if key == "fruits and fruit juices" and "juice" in desc:
        return "beverage"

    if key == "nut and seed products":
        head = desc.split(",")[0]
        if "seed" in head and "nut" not in head:
            return "seed"
        return "nut"

    return mapped if mapped in KOLIBI_CATEGORIES else "other"
