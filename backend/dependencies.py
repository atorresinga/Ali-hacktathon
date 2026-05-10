from __future__ import annotations

from fastapi import Header, Query

from backend.i18n.locale import resolve_language


def language_dependency(
    lang: str | None = Query(
        default=None,
        description="Presentation language: es (Spanish), qu (Quechua), ay (Aymara).",
    ),
    accept_language: str | None = Header(
        default=None,
        alias="Accept-Language",
        description="RFC Accept-Language, e.g. qu-PE,es;q=0.8",
    ),
) -> str:
    return resolve_language(lang_query=lang, accept_language=accept_language)
