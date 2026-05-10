from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Iterable

import pandas as pd

from andean_potato.database import connect, log_ingest_finish, log_ingest_start
from andean_potato.extract.network import (
    fetch_extra_csv_frames,
    normalize_external_csv,
    try_fetch_sisap_placeholder_rows,
)
from andean_potato.extract.synthetic import build_demo_lima_gmml_frame
from andean_potato.settings import EXTRA_CSV_URLS, FETCH_SISAP_HTML


def mark_price_outliers(df: pd.DataFrame) -> pd.DataFrame:
    """Flag outliers with IQR per (variety, market)."""
    out = df.copy()
    out["is_outlier"] = False
    for (var, mkt), grp in out.groupby(["variety", "market"]):
        q1 = grp["price_soles_per_kg"].quantile(0.25)
        q3 = grp["price_soles_per_kg"].quantile(0.75)
        iqr = q3 - q1
        if iqr <= 0:
            continue
        lo = q1 - 1.5 * iqr
        hi = q3 + 1.5 * iqr
        mask = (out["variety"] == var) & (out["market"] == mkt)
        bad = mask & ((out["price_soles_per_kg"] < lo) | (out["price_soles_per_kg"] > hi))
        out.loc[bad, "is_outlier"] = True
    return out


def _prepare_frame(df: pd.DataFrame) -> pd.DataFrame:
    required = [
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
    ]
    for c in required:
        if c not in df.columns:
            df[c] = None
    df = df[required].copy()
    df["product"] = df["product"].fillna("potato").astype(str)
    df["obs_date"] = pd.to_datetime(df["obs_date"]).dt.strftime("%Y-%m-%d")
    df["price_soles_per_kg"] = pd.to_numeric(df["price_soles_per_kg"], errors="coerce")
    df["volume_tonnes"] = pd.to_numeric(df["volume_tonnes"], errors="coerce")
    df["truck_count"] = pd.to_numeric(df["truck_count"], errors="coerce")
    df = df.dropna(subset=["obs_date", "price_soles_per_kg", "variety", "market", "source"])
    df = mark_price_outliers(df)
    return df


def upsert_observations(conn: sqlite3.Connection, df: pd.DataFrame) -> int:
    rows = 0
    for rec in df.to_dict(orient="records"):
        vol = rec.get("volume_tonnes")
        trucks = rec.get("truck_count")
        prov = rec.get("provenance_region")
        url = rec.get("source_file_url")
        conn.execute(
            """
            INSERT INTO observations (
                obs_date, market, product, variety, provenance_region,
                price_soles_per_kg, volume_tonnes, truck_count,
                source, source_file_url, retrieved_at, is_outlier
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(obs_date, variety, market, source) DO UPDATE SET
                provenance_region=excluded.provenance_region,
                price_soles_per_kg=excluded.price_soles_per_kg,
                volume_tonnes=excluded.volume_tonnes,
                truck_count=excluded.truck_count,
                source_file_url=excluded.source_file_url,
                retrieved_at=excluded.retrieved_at,
                is_outlier=excluded.is_outlier
            """,
            (
                rec["obs_date"],
                rec["market"],
                rec["product"],
                rec["variety"],
                None if prov is None or (isinstance(prov, float) and pd.isna(prov)) else str(prov),
                float(rec["price_soles_per_kg"]),
                None if vol is None or (isinstance(vol, float) and pd.isna(vol)) else float(vol),
                None if trucks is None or (isinstance(trucks, float) and pd.isna(trucks)) else int(trucks),
                rec["source"],
                None if url is None or (isinstance(url, float) and pd.isna(url)) else str(url),
                rec["retrieved_at"],
                1 if bool(rec.get("is_outlier")) else 0,
            ),
        )
        rows += 1
    conn.commit()
    return rows


def load_frames_into_sqlite(
    frames: Iterable[pd.DataFrame],
    conn: sqlite3.Connection,
    ingest_label: str,
) -> int:
    run_id = log_ingest_start(conn, ingest_label)
    total = 0
    try:
        for fr in frames:
            prep = _prepare_frame(fr)
            total += upsert_observations(conn, prep)
        log_ingest_finish(conn, run_id, "ok", f"rows_upserted={total}")
    except Exception as exc:  # noqa: BLE001
        log_ingest_finish(conn, run_id, "error", str(exc))
        raise
    return total


def run_default_ingest() -> dict:
    """Seed demo data, optional CSV URLs, optional SISAP HTTP probe."""
    with connect() as conn:
        frames: list[pd.DataFrame] = [build_demo_lima_gmml_frame()]
        if EXTRA_CSV_URLS:
            for raw in fetch_extra_csv_frames(EXTRA_CSV_URLS):
                norm = normalize_external_csv(raw)
                if norm is not None and not norm.empty:
                    frames.append(norm)
        if FETCH_SISAP_HTML:
            try_fetch_sisap_placeholder_rows()
        n = load_frames_into_sqlite(frames, conn, "default_batch")
        last = conn.execute(
            "SELECT COUNT(*) AS c FROM observations"
        ).fetchone()["c"]
    return {"upserted": n, "observation_count": int(last)}


def data_health_summary(conn: sqlite3.Connection) -> dict:
    row = conn.execute(
        """
        SELECT
            MIN(obs_date) AS min_d,
            MAX(obs_date) AS max_d,
            COUNT(*) AS n,
            SUM(is_outlier) AS outliers
        FROM observations
        """
    ).fetchone()
    gaps = conn.execute(
        """
        WITH d AS (
          SELECT obs_date FROM observations GROUP BY obs_date
        )
        SELECT COUNT(*) FROM d
        """
    ).fetchone()[0]
    by_source = conn.execute(
        "SELECT source, COUNT(*) c FROM observations GROUP BY source"
    ).fetchall()
    return {
        "min_date": row["min_d"],
        "max_date": row["max_d"],
        "rows": int(row["n"]),
        "outlier_rows": int(row["outliers"] or 0),
        "distinct_days": int(gaps),
        "by_source": {r["source"]: int(r["c"]) for r in by_source},
    }
