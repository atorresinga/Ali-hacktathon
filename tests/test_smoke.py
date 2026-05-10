from __future__ import annotations

import os
from pathlib import Path

# Configure DB path before any `andean_potato` import (settings reads env at import time).
_ROOT = Path(__file__).resolve().parents[1]
os.environ["ANDEAN_SQLITE_PATH"] = str(_ROOT / "data" / "test_api.sqlite3")

import pytest
from fastapi.testclient import TestClient

from andean_potato.database import init_db
from andean_potato.etl.ingest import run_default_ingest

Path(os.environ["ANDEAN_SQLITE_PATH"]).unlink(missing_ok=True)
init_db()
run_default_ingest()

from backend.main import app


@pytest.fixture()
def client():
    return TestClient(app)


def test_health_v1(client: TestClient):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["observations"] > 0


def test_forecast_v1(client: TestClient):
    r = client.get(
        "/api/v1/forecast",
        params={"variety": "Papa Canchan", "lang": "es"},
    )
    assert r.status_code == 200
    assert len(r.json()["horizons"]) == 4
    assert "localized" in r.json()


def test_insights_farmer_qu(client: TestClient):
    r = client.get(
        "/api/v1/insights/farmer",
        params={"variety": "Papa Canchan", "lang": "qu"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "qu"
    assert "localized" in body
    assert body["localized"]["sms"]


def test_i18n_labels(client: TestClient):
    r = client.get("/api/v1/i18n/labels", params={"lang": "ay"})
    assert r.status_code == 200
    assert r.json()["language"] == "ay"
    assert "page_title" in r.json()["labels"]


def test_governance_fairness(client: TestClient):
    r = client.get("/api/v1/governance/fairness", params={"lang": "es"})
    assert r.status_code == 200
    assert "principles" in r.json()
    assert "official_sources" in r.json()
