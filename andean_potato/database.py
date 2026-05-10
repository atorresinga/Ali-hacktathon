from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from andean_potato.settings import SQLITE_PATH

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    obs_date TEXT NOT NULL,
    market TEXT NOT NULL,
    product TEXT NOT NULL,
    variety TEXT NOT NULL,
    provenance_region TEXT,
    price_soles_per_kg REAL NOT NULL,
    volume_tonnes REAL,
    truck_count INTEGER,
    source TEXT NOT NULL,
    source_file_url TEXT,
    retrieved_at TEXT NOT NULL,
    is_outlier INTEGER NOT NULL DEFAULT 0,
    UNIQUE (obs_date, variety, market, source)
);

CREATE TABLE IF NOT EXISTS ingest_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    detail TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_obs_date_variety
ON observations (obs_date, variety);
"""


def init_db(path: Path | None = None) -> Path:
    p = path or SQLITE_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(p) as conn:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    return p


@contextmanager
def connect(path: Path | None = None):
    p = path or SQLITE_PATH
    init_db(p)
    conn = sqlite3.connect(p)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def log_ingest_start(conn: sqlite3.Connection, source: str) -> int:
    cur = conn.execute(
        """
        INSERT INTO ingest_runs (source, status, detail, started_at)
        VALUES (?, 'running', NULL, ?)
        """,
        (source, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    return int(cur.lastrowid)


def log_ingest_finish(
    conn: sqlite3.Connection,
    run_id: int,
    status: str,
    detail: str | None = None,
) -> None:
    conn.execute(
        """
        UPDATE ingest_runs
        SET status = ?, detail = ?, finished_at = ?
        WHERE id = ?
        """,
        (
            status,
            detail,
            datetime.now(timezone.utc).isoformat(),
            run_id,
        ),
    )
    conn.commit()


def last_successful_ingest(conn: sqlite3.Connection) -> dict | None:
    row = conn.execute(
        """
        SELECT source, finished_at, detail
        FROM ingest_runs
        WHERE status = 'ok' AND finished_at IS NOT NULL
        ORDER BY datetime(finished_at) DESC
        LIMIT 1
        """
    ).fetchone()
    if row is None:
        return None
    return {"source": row["source"], "finished_at": row["finished_at"], "detail": row["detail"]}
