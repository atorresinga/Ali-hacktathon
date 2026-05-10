# MVP — Andean potato wholesale (GMML)

This folder holds the **product narrative** and **API documentation** for the hackathon MVP.

| File | Contents |
|------|----------|
| [MVP.md](MVP.md) | Problem statement and wedge (SISAP / GMML forecasting). |
| [BACKEND.md](BACKEND.md) | HTTP backend: routes, i18n (`es` / `qu` / `ay`), fairness endpoints. |

## Run the stack (repository root)

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"     # app + pytest; omit [dev] if you skip tests
```

Copy `.env.example` from the repository root to `.env` if you need custom paths or CSV URLs.

**Backend API**

```bash
uvicorn backend.main:app --reload --port 8000
```

Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Example: `GET /api/v1/insights/farmer?variety=Papa%20Canchan&lang=es`.

**Farmer UI (React)** — from repository root:

```bash
cd frontend && npm install && npm run dev
```

Keep the backend on port **8000**; Vite (default **5173**) proxies `/api` to the backend. Open **http://127.0.0.1:5173/**. Same UI is bundled for iOS via Capacitor — see [../IOS.md](../IOS.md). Web alternate: **http://127.0.0.1:8000/app/** after `frontend` build + backend static mount.

**Optional:** `pip install -e ".[ui]"` adds Streamlit for experiments only.

Core code: `andean_potato/` (data + forecast), `backend/` (API), `frontend/` (UI).
