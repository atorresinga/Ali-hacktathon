"""Deterministic demo series when live portals are unavailable or blocked."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd

# Commercial potato names (Peru GMML-style demo series); distinct series per variety.
VARIETY_BASE_SOLES_PER_KG: dict[str, float] = {
    "Papa Canchan": 1.15,
    "Papa Yungay": 1.35,
    "Papa Amarilla": 2.1,
    "Papa Huayro": 1.52,
    "Papa Peruanita": 1.88,
    "Papa Tumbay": 1.41,
    "Papa Nevadita": 1.26,
    "Papa Sumac Sara": 1.64,
}
VARIETIES = list(VARIETY_BASE_SOLES_PER_KG.keys())
REGIONS = ["Junín", "Huánuco", "Puno", "Ayacucho"]


def build_demo_lima_gmml_frame(
    end: date | None = None,
    days: int = 420,
    seed: int = 42,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    end_d = end or date.today()
    idx = pd.date_range(end=end_d, periods=days, freq="D")

    rows: list[dict] = []
    retrieved = datetime.now(timezone.utc).isoformat()
    for dt in idx:
        d = dt.date()
        for variety in VARIETIES:
            # Cobweb-ish: periodic glut + noise
            t = np.sin(2 * np.pi * dt.dayofyear / 365.0)
            base = VARIETY_BASE_SOLES_PER_KG[variety]
            price = base * (1.0 + 0.22 * t) + rng.normal(0, 0.06)
            price = float(max(0.35, price))
            vol = max(0.0, 180 + 120 * (-t) + rng.normal(0, 25))
            prov = REGIONS[int(rng.integers(0, len(REGIONS)))]
            rows.append(
                {
                    "obs_date": d.isoformat(),
                    "market": "GMML_Lima",
                    "product": "potato",
                    "variety": variety,
                    "provenance_region": prov,
                    "price_soles_per_kg": price,
                    "volume_tonnes": float(vol),
                    "truck_count": None,
                    "source": "synthetic_demo",
                    "source_file_url": None,
                    "retrieved_at": retrieved,
                }
            )
    return pd.DataFrame(rows)
