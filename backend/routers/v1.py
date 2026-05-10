from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from andean_potato.database import connect, init_db, last_successful_ingest
from andean_potato.etl.ingest import data_health_summary, run_default_ingest
from andean_potato.forecast import forecast_price_horizons
from andean_potato.queries import daily_price_volume, list_markets, list_varieties
from backend.dependencies import language_dependency
from backend.i18n.strings import t, ui_strings
from backend.services.farmer_insight import build_farmer_insight
from backend.services.governance import fairness_payload
from backend.services.sms import build_localized_sms

router = APIRouter()


@router.get("/health")
def health_v1() -> dict[str, Any]:
    with connect() as conn:
        n = int(conn.execute("SELECT COUNT(*) c FROM observations").fetchone()["c"])
        last = last_successful_ingest(conn)
    return {"status": "ok", "observations": n, "last_ingest": last, "api_version": "v1"}


@router.get("/config/sources")
def config_sources(lang: str = Depends(language_dependency)) -> dict[str, Any]:
    from andean_potato.sources import (
        EMMSA_HOME,
        MIDAGRI_GOBPE_INSTITUTION,
        SISAP_PORTAL,
        SISAP_PORTAL2_MAYORISTA,
    )

    url_map = {
        "sisap_portal": SISAP_PORTAL,
        "sisap_portal2_mayorista": SISAP_PORTAL2_MAYORISTA,
        "midagri_gobpe": MIDAGRI_GOBPE_INSTITUTION,
        "emmsa_home": EMMSA_HOME,
    }
    links = [
        {"id": k, "title": t(lang, f"source.{k}"), "url": v}
        for k, v in url_map.items()
    ]
    return {
        "language": lang,
        "urls": url_map,
        "links": links,
        "attribution": "Datos: MIDAGRI / SISAP (y fuentes complementarias).",
        "ui_hint_sources_title": t(lang, "ui.sources"),
    }


@router.post("/ingest/run")
def ingest_run_v1() -> dict[str, Any]:
    return run_default_ingest()


@router.get("/meta/markets")
def meta_markets_v1(lang: str = Depends(language_dependency)) -> dict[str, Any]:
    with connect() as conn:
        markets = list_markets(conn)
    return {"language": lang, "markets": markets}


@router.get("/meta/ingest-recent")
def meta_ingest_recent_v1(
    limit: int = Query(25, ge=1, le=80),
    lang: str = Depends(language_dependency),
) -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT id, source, status, detail, started_at, finished_at
            FROM ingest_runs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    runs = [dict(r) for r in rows]
    return {"language": lang, "runs": runs}


@router.get("/meta/varieties")
def meta_varieties_v1(
    market: str = Query("GMML_Lima"),
    lang: str = Depends(language_dependency),
) -> dict[str, Any]:
    with connect() as conn:
        v = list_varieties(conn, market=market)
    return {"language": lang, "market": market, "varieties": v}


@router.get("/meta/data-health")
def meta_data_health_v1(lang: str = Depends(language_dependency)) -> dict[str, Any]:
    with connect() as conn:
        dh = data_health_summary(conn)
    return {"language": lang, "data_health": dh, "labels": {"data_health": t(lang, "ui.data_health")}}


@router.get("/series/daily")
def series_daily_v1(
    variety: str = Query(..., description="Variedad comercial"),
    market: str = Query("GMML_Lima"),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    lang: str = Depends(language_dependency),
) -> dict[str, Any]:
    with connect() as conn:
        df = daily_price_volume(conn, variety=variety, market=market)
    if df.empty:
        raise HTTPException(status_code=404, detail=t(lang, "advisory.no_data"))
    if start is not None:
        df = df[df["ds"] >= pd.Timestamp(start)]
    if end is not None:
        df = df[df["ds"] <= pd.Timestamp(end)]
    records = [
        {
            "ds": str(r.ds.date()),
            "price_soles_per_kg": float(r.price),
            "volume_tonnes": float(r.volume_tonnes)
            if r.volume_tonnes == r.volume_tonnes
            else None,
        }
        for r in df.itertuples(index=False)
    ]
    return {
        "language": lang,
        "variety": variety,
        "market": market,
        "series": records,
        "labels": {
            "price": t(lang, "ui.price_axis"),
            "volume": t(lang, "ui.volume_axis"),
            "page": t(lang, "ui.page_title"),
        },
    }


@router.get("/forecast")
def forecast_v1(
    variety: str = Query(...),
    market: str = Query("GMML_Lima"),
    lang: str = Depends(language_dependency),
) -> dict[str, Any]:
    with connect() as conn:
        daily = daily_price_volume(conn, variety=variety, market=market)
    if daily.empty:
        raise HTTPException(status_code=404, detail=t(lang, "advisory.no_data"))
    fc = forecast_price_horizons(daily)
    method_key = (
        "forecast.method_ets"
        if fc.get("method") == "ets_hw"
        else "forecast.method_linear"
    )
    fc_out = {**fc, "variety": variety, "market": market, "language": lang}
    fc_out["localized"] = {
        "title": t(lang, "ui.forecast_block"),
        "method_explanation": t(lang, method_key),
    }
    return fc_out


@router.get("/advisory/sms")
def advisory_sms_v1(
    variety: str = Query(...),
    market: str = Query("GMML_Lima"),
    lang: str = Depends(language_dependency),
) -> dict[str, str]:
    with connect() as conn:
        text = build_localized_sms(conn, variety=variety, market=market, lang=lang)
    return {"language": lang, "variety": variety, "market": market, "sms": text}


@router.get("/insights/farmer")
def insights_farmer_v1(
    variety: str = Query(...),
    market: str = Query("GMML_Lima"),
    lang: str = Depends(language_dependency),
) -> dict[str, Any]:
    with connect() as conn:
        payload = build_farmer_insight(conn, variety=variety, market=market, lang=lang)
    return payload


@router.get("/governance/fairness")
def governance_fairness_v1(lang: str = Depends(language_dependency)) -> dict[str, Any]:
    body = fairness_payload(lang)
    body["language"] = lang
    return body


@router.get("/i18n/labels")
def i18n_labels_v1(lang: str = Depends(language_dependency)) -> dict[str, Any]:
    return {"language": lang, "labels": ui_strings(lang)}
