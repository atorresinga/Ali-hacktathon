from __future__ import annotations

import re

SUPPORTED_LANGS = frozenset({"es", "qu", "ay"})
DEFAULT_LANG = "es"


def resolve_language(
    *,
    lang_query: str | None,
    accept_language: str | None,
) -> str:
    """
    Resolve UI language: query param wins, then Accept-Language, then Spanish.
    Accepts es-CO, qu-PE, etc. — uses two-letter prefix when in SUPPORTED_LANGS.
    """
    if lang_query:
        code = lang_query.strip().lower()[:2]
        if code in SUPPORTED_LANGS:
            return code
    if accept_language:
        # RFC-like: split by comma, parse q values
        for part in accept_language.split(","):
            token = part.split(";")[0].strip().lower()
            if not token:
                continue
            base = token.split("-")[0][:2]
            if base in SUPPORTED_LANGS:
                return base
    return DEFAULT_LANG


def parse_accept_language(value: str | None) -> str | None:
    if not value:
        return None
    m = re.search(r"\b(es|qu|ay)\b", value.lower())
    return m.group(1) if m else None
