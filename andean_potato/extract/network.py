"""Best-effort HTTP extraction: optional CSV URLs and light SISAP portal probing."""

from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import requests

from andean_potato.sources import SISAP_PORTAL2_MAYORISTA

logger = logging.getLogger(__name__)
TIMEOUT = (5, 25)


def fetch_extra_csv_frames(urls: list[str]) -> list[pd.DataFrame]:
    frames: list[pd.DataFrame] = []
    for url in urls:
        try:
            r = requests.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            buf = io.BytesIO(r.content)
            df = pd.read_csv(buf)
            df["__source_url"] = url
            frames.append(df)
        except Exception as exc:  # noqa: BLE001
            logger.warning("CSV fetch failed for %s: %s", url, exc)
    return frames


def normalize_external_csv(df: pd.DataFrame) -> pd.DataFrame | None:
    """Map common Spanish column names to internal schema if present."""
    cols = {c.lower().strip(): c for c in df.columns}
    lower = set(cols.keys())

    def pick(*names: str) -> str | None:
        for n in names:
            if n in lower:
                return cols[n]
        return None

    c_date = pick("fecha", "obs_date", "dia")
    c_price = pick("precio", "precio_soles_kg", "precio_kg", "precio_soles_per_kg")
    c_var = pick("variedad", "variety", "producto")
    if c_date is None or c_price is None:
        return None

    mcol = pick("mercado", "market")
    if mcol:
        market_series = df[mcol].astype(str)
    else:
        market_series = pd.Series(["external_market"] * len(df), index=df.index)

    out = pd.DataFrame(
        {
            "obs_date": pd.to_datetime(df[c_date], errors="coerce").dt.date.astype(str),
            "market": market_series,
            "product": "potato",
            "variety": df[c_var] if c_var else "unknown",
            "provenance_region": df.get(pick("procedencia", "region", "provenance_region")),
            "price_soles_per_kg": pd.to_numeric(df[c_price], errors="coerce"),
            "volume_tonnes": pd.to_numeric(
                df.get(pick("volumen_t", "toneladas", "volume_tonnes")), errors="coerce"
            ),
            "truck_count": pd.to_numeric(
                df.get(pick("camiones", "truck_count")), errors="coerce"
            ),
            "source": "external_csv",
            "source_file_url": df.get("__source_url"),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    out = out.dropna(subset=["obs_date", "price_soles_per_kg"])
    return out


def try_fetch_sisap_placeholder_rows() -> list[dict[str, Any]]:
    """
    Lightweight reachability check; does not parse SPA payloads.
    Returns empty list — use DevTools-derived endpoints when available.
    """
    try:
        r = requests.get(SISAP_PORTAL2_MAYORISTA, timeout=TIMEOUT)
        r.raise_for_status()
        logger.info("SISAP mayorista portal HTTP %s bytes", len(r.content))
    except Exception as exc:  # noqa: BLE001
        logger.warning("SISAP probe failed: %s", exc)
    return []
