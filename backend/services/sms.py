from __future__ import annotations

import sqlite3

from andean_potato.forecast import forecast_price_horizons
from andean_potato.queries import daily_price_volume

from backend.i18n.strings import t
from backend.services.metrics import supply_regime, volume_pressure_zscore


def build_localized_sms(
    conn: sqlite3.Connection,
    *,
    variety: str,
    market: str,
    lang: str,
    max_chars: int = 320,
) -> str:
    daily = daily_price_volume(conn, variety=variety, market=market)
    if daily.empty:
        return t(lang, "advisory.no_data")

    fc = forecast_price_horizons(daily)
    z = volume_pressure_zscore(daily)
    reg = supply_regime(z)
    supply_key = {"high": "sms.supply_high", "low": "sms.supply_low", "neutral": "sms.supply_mid"}[
        reg
    ]

    h7 = next((h for h in fc.get("horizons", []) if h["days"] == 7), None)
    last_p = fc.get("last_price")
    last_d = fc.get("last_obs_date")

    if h7 is None or last_p is None:
        return t(lang, "advisory.no_data")[:max_chars]

    delta = h7["price_mean"] - float(last_p)
    dir_key = "sms.dir_up" if delta >= 0 else "sms.dir_down"
    msg = t(
        lang,
        "sms.template",
        variety=variety,
        last=f"{float(last_p):.2f}",
        date=last_d,
        dir=t(lang, dir_key),
        p7=f"{h7['price_mean']:.2f}",
        supply=t(lang, supply_key),
    )
    return msg[:max_chars]
