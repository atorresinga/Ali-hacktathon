"""
BACKEND ASGI APPLICATION — mount point: `uvicorn backend.main:app`
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from andean_potato.database import connect, init_db
from andean_potato.etl.ingest import run_default_ingest
from backend.routers.v1 import router as v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with connect() as conn:
        n = conn.execute("SELECT COUNT(*) AS c FROM observations").fetchone()["c"]
        if int(n) == 0:
            run_default_ingest()
    yield


app = FastAPI(
    title="Andean Potato — BACKEND (GMML advisory API)",
    description="Farmer-oriented JSON API with i18n (es/qu/ay), insights, and governance.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")

_FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount(
        "/app",
        StaticFiles(directory=str(_FRONTEND_DIST), html=True),
        name="frontend",
    )


@app.get("/")
def root() -> dict[str, str]:
    out = {
        "service": "andean-potato-backend",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "api_v1": "/api/v1/health",
        "note": "See mvp/BACKEND.md for route map and i18n.",
    }
    if _FRONTEND_DIST.is_dir():
        out["farmer_ui"] = "/app/"
    return out
