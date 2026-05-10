from __future__ import annotations

import pandas as pd


def volume_pressure_zscore(daily: pd.DataFrame) -> float:
    """Compare last 14d mean volume to prior history (z-like)."""
    vol = daily.set_index("ds")["volume_tonnes"]
    v = vol.dropna()
    if v.empty or len(v) < 16:
        return 0.0
    tail = v.tail(14)
    hist = v.iloc[:-14] if len(v) > 30 else v.iloc[:-7]
    if hist.empty:
        return 0.0
    mu, sigma = float(hist.mean()), float(hist.std()) or 1e-6
    return float((float(tail.mean()) - mu) / sigma)


def price_change_pct(daily: pd.DataFrame, days: int = 7) -> float | None:
    if len(daily) < days + 1:
        return None
    last = float(daily["price"].iloc[-1])
    prev = float(daily["price"].iloc[-1 - days])
    if prev == 0:
        return None
    return round((last - prev) / prev * 100.0, 2)


def volatility_30d(daily: pd.DataFrame) -> float | None:
    tail = daily["price"].tail(30)
    if len(tail) < 10:
        return None
    mu = float(tail.mean())
    if mu == 0:
        return None
    return round(float(tail.std()) / mu, 4)


def supply_regime(z: float) -> str:
    if z > 0.8:
        return "high"
    if z < -0.8:
        return "low"
    return "neutral"


def build_metrics(daily: pd.DataFrame) -> dict:
    if daily.empty:
        return {}
    z = volume_pressure_zscore(daily)
    return {
        "last_price_soles_per_kg": float(daily["price"].iloc[-1]),
        "last_obs_date": str(daily["ds"].iloc[-1].date()),
        "change_7d_pct": price_change_pct(daily, 7),
        "volume_pressure_z": z,
        "supply_regime": supply_regime(z),
        "volatility_30d_coefficient": volatility_30d(daily),
        "data_days": int(len(daily)),
    }
