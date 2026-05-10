from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

HORIZONS = (7, 14, 21, 28)


def forecast_price_horizons(
    daily: pd.DataFrame,
    horizons: tuple[int, ...] = HORIZONS,
) -> dict[str, Any]:
    """
    Baseline: Holt-Winters style exponential smoothing with weekly seasonality.
    Falls back to linear trend on last 60 days if fit fails.
    """
    if daily.empty or len(daily) < 21:
        return {"method": "insufficient_data", "horizons": [], "detail": "need more history"}

    y = daily["price"].astype(float).values
    max_h = max(horizons)

    method = "ets_hw"
    pred = None
    try:
        model = ExponentialSmoothing(
            y,
            trend="add",
            seasonal="add",
            seasonal_periods=7,
            initialization_method="estimated",
        )
        fit = model.fit(optimized=True)
        pred = fit.forecast(steps=max_h)
        resid_sigma = float(np.std(fit.resid[~np.isnan(fit.resid)])) or 0.05
    except Exception:  # noqa: BLE001
        method = "linear_trend_fallback"
        x = np.arange(len(y))
        window = y[-60:] if len(y) >= 60 else y
        xw = np.arange(len(window))
        coef = np.polyfit(xw, window, 1)
        slope, intercept = coef[0], coef[1]
        base = float(window[-1])
        pred = np.array(
            [base + slope * (k + 1) for k in range(max_h)]
        )
        resid_sigma = float(np.std(np.diff(window))) or 0.05

    pred = np.maximum(pred, 0.05)  # guard negative prices
    out = []
    z = 1.28  # ~80% if Gaussian (rough)
    for h in horizons:
        idx = h - 1
        mean_p = float(pred[idx])
        band = z * resid_sigma * math.sqrt(h / 7.0)
        out.append(
            {
                "days": h,
                "price_mean": mean_p,
                "price_low": max(0.05, mean_p - band),
                "price_high": mean_p + band,
            }
        )

    last_row = daily.iloc[-1]
    return {
        "method": method,
        "last_obs_date": str(last_row["ds"].date()),
        "last_price": float(last_row["price"]),
        "horizons": out,
    }
