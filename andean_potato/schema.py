from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

SourceTag = Literal[
    "sisap_portal",
    "midagri_boletin",
    "midagri_reporte_mayorista",
    "emmsa",
    "synthetic_demo",
    "external_csv",
]


@dataclass(frozen=True)
class PotatoObservation:
    obs_date: date
    market: str
    product: str
    variety: str
    provenance_region: str | None
    price_soles_per_kg: float
    volume_tonnes: float | None
    truck_count: int | None
    source: SourceTag
    source_file_url: str | None
    retrieved_at: str  # ISO8601
    is_outlier: bool = False


OBSERVATION_COLUMNS = [
    "obs_date",
    "market",
    "product",
    "variety",
    "provenance_region",
    "price_soles_per_kg",
    "volume_tonnes",
    "truck_count",
    "source",
    "source_file_url",
    "retrieved_at",
    "is_outlier",
]
