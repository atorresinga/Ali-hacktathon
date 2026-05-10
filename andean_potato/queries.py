from __future__ import annotations

import sqlite3

import pandas as pd


def daily_price_volume(
    conn: sqlite3.Connection,
    variety: str,
    market: str = "GMML_Lima",
) -> pd.DataFrame:
    """One row per calendar day: mean price, mean volume (ignoring null volumes)."""
    q = """
    SELECT
        obs_date AS ds,
        AVG(price_soles_per_kg) AS price,
        AVG(CASE WHEN volume_tonnes IS NOT NULL THEN volume_tonnes END) AS volume_tonnes
    FROM observations
    WHERE variety = ? AND market = ?
    GROUP BY obs_date
    ORDER BY obs_date
    """
    df = pd.read_sql_query(q, conn, params=(variety, market))
    if df.empty:
        return df
    df["ds"] = pd.to_datetime(df["ds"])
    df = df.set_index("ds").sort_index()
    full = pd.date_range(df.index.min(), df.index.max(), freq="D")
    df = df.reindex(full)
    df["price"] = df["price"].interpolate(limit_direction="both")
    df["volume_tonnes"] = df["volume_tonnes"].interpolate(limit_direction="both")
    df.index.name = "ds"
    return df.reset_index()


def list_markets(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT DISTINCT market FROM observations ORDER BY market"
    ).fetchall()
    return [r[0] for r in rows]


def list_varieties(conn: sqlite3.Connection, market: str | None = None) -> list[str]:
    if market:
        rows = conn.execute(
            "SELECT DISTINCT variety FROM observations WHERE market = ? ORDER BY variety",
            (market,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT DISTINCT variety FROM observations ORDER BY variety"
        ).fetchall()
    return [r[0] for r in rows]
