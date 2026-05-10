from __future__ import annotations

from andean_potato.sources import (
    EMMSA_HOME,
    MIDAGRI_GOBPE_INSTITUTION,
    SISAP_PORTAL,
    SISAP_PORTAL2_MAYORISTA,
)

from backend.i18n.strings import t


def fairness_payload(lang: str) -> dict:
    return {
        "language": lang,
        "principles": [
            t(lang, "governance.fair_use"),
            t(lang, "governance.uncertainty"),
        ],
        "title": t(lang, "governance.title"),
        "official_sources": {
            "sisap_portal": SISAP_PORTAL,
            "sisap_portal2_mayorista": SISAP_PORTAL2_MAYORISTA,
            "midagri_gobpe": MIDAGRI_GOBPE_INSTITUTION,
            "emmsa_home": EMMSA_HOME,
        },
        "attribution_es": "Datos: MIDAGRI / SISAP (y fuentes complementarias).",
        "limitations": [
            "El MVP puede usar datos sintéticos si la extracción en vivo falla.",
            "Los pronósticos no sustituyen negociación ni asesoría técnica oficial.",
            "Revise siempre la fecha de la última ingestión.",
        ],
        "non_discrimination": (
            "El servicio no usa datos personales ni trata distinto a cooperativas; "
            "solo agrega señales de mercado públicas."
        ),
    }
