# Rural pricing — frontend (React + Vite)

Merged from the pulled mobile UI and wired to the **FastAPI backend** (`/api/v1`).

## Development (two terminals)

1. **Backend** (repo root): `uvicorn backend.main:app --reload --port 8000`
2. **Frontend**: `cd frontend && npm install && npm run dev`

Vite proxies `/api` → `http://127.0.0.1:8000`, so the browser calls same-origin `/api/v1/...`.

The app is served under **`/app/`** (see `base` in `vite.config.ts`). In dev open **http://127.0.0.1:5173/app/** (not the bare root).

## Production API URL

Build with:

```bash
VITE_API_BASE=https://your-api-host npm run build
```

If `VITE_API_BASE` is empty, the app uses relative `/api` (same host). After `npm run build`, you can serve the `dist/` folder via the backend at **`http://127.0.0.1:8000/app/`** (see `backend/main.py`).

## Tabs

- **Inicio** — dashboard, alerts, “Preparar precio” opens a sheet with copy + WhatsApp.
- **Mercados** — official MIDAGRI/SISAP links and local data-health stats from the API.
- **Precio** — last ~21 days of daily prices + 7–28d forecast table for a chosen potato variety.
- **Ventas** — **private sales log** on this device (`localStorage`): record real sales (date, product, kg, S/kg, buyer) to compare with mayorista guidance. Not a marketplace; clear all with “Borrar historial”.

Language **es / qu / ay** loads UI strings from `GET /api/v1/i18n/labels` (Quechua/Aymara are MVP strings; review with native speakers before production).

## Stack

- React 18 + TypeScript + Vite 5
- Tailwind CSS 3
- Local `Card` / `Button` stubs (replacing `@/components/ui/*` from the original snippet)
