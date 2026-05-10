from __future__ import annotations

import sqlite3

import pandas as pd

from andean_potato.forecast import forecast_price_horizons
from andean_potato.queries import daily_price_volume


def _volume_pressure_index(vol: pd.Series) -> float:
    if vol.dropna().empty:
        return 0.0
    tail = vol.dropna().tail(14)
    hist = vol.dropna().iloc[:-14] if len(vol.dropna()) > 30 else vol.dropna()
    if hist.empty:
        return 0.0
    mu, sigma = float(hist.mean()), float(hist.std()) or 1e-6
    z = (float(tail.mean()) - mu) / sigma
    return float(z)


def build_sms_bullet(
    conn: sqlite3.Connection,
    variety: str,
    market: str = "GMML_Lima",
    max_chars: int = 300,
) -> str:
    """
    Cooperative-facing, low-bandwidth summary (Spanish, template-based).
    """
    daily = daily_price_volume(conn, variety, market)
    if daily.empty:
        return "Sin datos recientes para esta variedad. Datos: MIDAGRI/SISAP (demo)."

    fc = forecast_price_horizons(daily)
    vpi = _volume_pressure_index(daily.set_index("ds")["volume_tonnes"])

    h7 = next((h for h in fc.get("horizons", []) if h["days"] == 7), None)
    last_p = fc.get("last_price")
    last_d = fc.get("last_obs_date")

    if h7 is None or last_p is None:
        msg = f"{variety}: precio reciente S/ {last_p:.2f}/kg ({last_d}). Revise panel web."
    else:
        delta = h7["price_mean"] - float(last_p)
        direction = "sube" if delta >= 0 else "baja"
        supply = "presión de ingreso alta" if vpi > 0.8 else "presión de ingreso baja" if vpi < -0.8 else "ingreso estable"
        msg = (
            f"{variety} GMML: último S/{last_p:.2f}/kg ({last_d}). "
            f"7d: {direction} hacia ~S/{h7['price_mean']:.2f} ({supply}). "
            f"Datos: MIDAGRI/SISAP (MVP)."
        )
    return msg[:max_chars]
