# Backend — Andean potato GMML advisory API

This document describes the **HTTP backend** for the farmer-facing tool. Application code lives in the [`backend/`](../backend/) Python package (`backend.main:app`). The domain layer (database, ETL, forecasting) remains in [`andean_potato/`](../andean_potato/).

## Run

```bash
# from repository root, with venv activated
uvicorn backend.main:app --reload --port 8000
```

## Design goals

- **Meaningful data**: numeric series and forecasts are language-agnostic; every localized response also exposes `metrics` / `series` where relevant.
- **Fairness & transparency**: `GET /api/v1/governance/fairness` states data sources, limitations, model uncertainty, and that the service does not discriminate by person or cooperative—only public market signals.
- **i18n**: Spanish (`es`) default; **Quechua** (`qu`) and **Aymara** (`ay`) via `?lang=` or `Accept-Language`. Copy should be **reviewed by native speakers** before production; keys are stable for the future frontend.

## API base

All versioned routes: **`/api/v1/...`**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Liveness + observation count + last ingest |
| GET | `/api/v1/config/sources` | MIDAGRI / SISAP / EMMSA URLs + attribution |
| POST | `/api/v1/ingest/run` | Refresh demo / configured CSV ingest |
| GET | `/api/v1/meta/varieties` | Varieties for a market |
| GET | `/api/v1/meta/data-health` | Date span, outliers, rows by source |
| GET | `/api/v1/series/daily` | Daily price + volume (`variety`, `market`, optional `start`/`end`) |
| GET | `/api/v1/forecast` | Horizons 7–28d + **localized** interpretation |
| GET | `/api/v1/advisory/sms` | Short message for SMS/WhatsApp (`lang`) |
| GET | `/api/v1/insights/farmer` | **One-call** insight: metrics + forecast + localized narrative + fairness hints |
| GET | `/api/v1/governance/fairness` | Transparency, limitations, uncertainty guidance |
| GET | `/api/v1/i18n/labels` | Static UI strings for a future SPA (charts, buttons, help) |

### Language selection

1. Query `lang=es|qu|ay` if present (recommended for explicit user choice).
2. Else `Accept-Language` header (first supported match).
3. Else `es`.

## Response shape (farmer insight)

`GET /api/v1/insights/farmer` returns JSON with:

- `language`, `variety`, `market`
- `metrics` — last price, % change vs 7d ago, volume pressure (z-like), data days
- `forecast` — same structure as core forecast + horizons
- `localized` — `headline`, `bullets`, `sms`, `disclaimer`
- `governance` — short fairness summary (full text in `/governance/fairness`)

## Notes for the future frontend

- Prefer **`/api/v1/insights/farmer`** for a single dashboard load (Spanish default, switch `lang`).
- Cache **`/api/v1/i18n/labels?lang=`** per session to avoid repeating large payloads.
- Charts should use **`/api/v1/series/daily`** (numbers only) and read titles from i18n labels.

## Same-origin farmer UI

After `cd frontend && npm run build`, `backend.main` mounts the Vite build at **`/app/`** (e.g. `http://127.0.0.1:8000/app/`) so the UI and `/api/v1` share one origin.
