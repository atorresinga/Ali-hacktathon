from __future__ import annotations

import sqlite3

from andean_potato.forecast import forecast_price_horizons
from andean_potato.queries import daily_price_volume

from backend.i18n.strings import t
from backend.services.metrics import build_metrics
from backend.services.sms import build_localized_sms


def build_farmer_insight(
    conn: sqlite3.Connection,
    *,
    variety: str,
    market: str,
    lang: str,
) -> dict:
    daily = daily_price_volume(conn, variety=variety, market=market)
    if daily.empty:
        return {
            "language": lang,
            "variety": variety,
            "market": market,
            "metrics": {},
            "forecast": {},
            "localized": {
                "headline": t(lang, "advisory.no_data"),
                "bullets": [],
                "sms": t(lang, "advisory.no_data"),
                "disclaimer": t(lang, "insights.disclaimer"),
            },
            "governance": {"summary": t(lang, "governance.uncertainty")},
        }

    metrics = build_metrics(daily)
    fc = forecast_price_horizons(daily)
    h7 = next((h for h in fc.get("horizons", []) if h["days"] == 7), None)

    chg = metrics.get("change_7d_pct")
    regime = metrics.get("supply_regime", "neutral")
    supply_key = {
        "high": "insights.supply_high",
        "low": "insights.supply_low",
        "neutral": "insights.supply_neutral",
    }[regime]

    if chg is None:
        headline = t(lang, "insights.headline_flat", variety=variety)
    elif chg > 0.05:
        headline = t(lang, "insights.headline_up", variety=variety, pct=abs(chg))
    elif chg < -0.05:
        headline = t(lang, "insights.headline_down", variety=variety, pct=abs(chg))
    else:
        headline = t(lang, "insights.headline_flat", variety=variety)

    bullets: list[str] = [t(lang, supply_key)]
    if h7 is not None:
        bullets.append(
            t(
                lang,
                "insights.bullet_forecast",
                p7=f"{h7['price_mean']:.2f}",
                lo=f"{h7['price_low']:.2f}",
                hi=f"{h7['price_high']:.2f}",
            )
        )
    bullets.append(t(lang, "insights.bullet_action_wait"))
    bullets.append(t(lang, "insights.bullet_action_coop"))

    sms = build_localized_sms(conn, variety=variety, market=market, lang=lang)

    method_key = (
        "forecast.method_ets"
        if fc.get("method") == "ets_hw"
        else "forecast.method_linear"
        if fc.get("method") == "linear_trend_fallback"
        else "forecast.method_linear"
    )

    return {
        "language": lang,
        "variety": variety,
        "market": market,
        "metrics": metrics,
        "forecast": fc,
        "localized": {
            "headline": headline,
            "bullets": bullets,
            "sms": sms,
            "disclaimer": t(lang, "insights.disclaimer"),
            "forecast_caption": t(lang, method_key),
        },
        "governance": {
            "summary": t(lang, "governance.fair_use"),
            "uncertainty": t(lang, "governance.uncertainty"),
            "supply_regime": metrics.get("supply_regime", "neutral"),
        },
    }
