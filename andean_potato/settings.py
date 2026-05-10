from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("ANDEAN_DATA_DIR", ROOT / "data"))
SQLITE_PATH = Path(
    os.environ.get("ANDEAN_SQLITE_PATH", DATA_DIR / "andean_potato.sqlite3")
)
FETCH_SISAP_HTML = os.environ.get("ANDEAN_FETCH_SISAP_HTML", "0") == "1"
EXTRA_CSV_URLS = [
    u.strip()
    for u in os.environ.get("ANDEAN_EXTRA_CSV_URLS", "").split(",")
    if u.strip()
]

DATA_DIR.mkdir(parents=True, exist_ok=True)
