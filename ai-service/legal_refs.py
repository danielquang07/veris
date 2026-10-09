"""Rule-based legal reference lookup for the Veris scam analyzer.

Loads ``data/legal_refs.json`` (regex patterns -> Vietnamese legal articles)
and matches them against the input text. No LLM involved: if nothing matches,
we return an empty list rather than fabricating a citation.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "data" / "legal_refs.json"


@dataclass(frozen=True)
class LegalRef:
    dieu: str
    khoan: str
    van_ban: str
    noi_dung: str
    link: str

    def to_dict(self) -> dict:
        return {
            "dieu": self.dieu,
            "khoan": self.khoan,
            "van_ban": self.van_ban,
            "noi_dung": self.noi_dung,
            "link": self.link,
        }


@dataclass(frozen=True)
class _Rule:
    pattern: re.Pattern[str]
    ref: LegalRef


@lru_cache(maxsize=1)
def _load_rules() -> tuple[_Rule, ...]:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    rules: list[_Rule] = []
    for item in raw:
        ref = LegalRef(
            dieu=str(item["dieu"]),
            khoan=str(item.get("khoan", "")),
            van_ban=str(item.get("van_ban", "")),
            noi_dung=str(item.get("noi_dung", "")),
            link=str(item.get("link", "")),
        )
        # case-insensitive; patterns already handle Vietnamese diacritics variants
        rules.append(_Rule(pattern=re.compile(item["pattern"], re.IGNORECASE), ref=ref))
    return tuple(rules)


def match_legal_refs(text: str) -> list[dict]:
    """Return the list of legal references matching ``text`` (possibly empty).

    Deduplicated by (van_ban, dieu, khoan) while preserving rule order.
    """
    if not text:
        return []
    lowered = text.lower()
    seen: set[tuple[str, str, str]] = set()
    out: list[dict] = []
    for rule in _load_rules():
        if rule.pattern.search(lowered):
            key = (rule.ref.van_ban, rule.ref.dieu, rule.ref.khoan)
            if key not in seen:
                seen.add(key)
                out.append(rule.ref.to_dict())
    return out
