# iOS app (Capacitor)

Capacitor wraps the Vite/React build from [`frontend/`](frontend/). Config lives at the **repository root**: [`capacitor.config.json`](capacitor.config.json) (`webDir`: `frontend/dist`).

## Full backend in Xcode (not “demo only”)

The React bundle must reach FastAPI. **Simulator:** when `VITE_API_BASE` is unset, the app detects **iOS Simulator** (WebView user agent) and uses **`http://127.0.0.1:8000`** (see `frontend/src/lib/api.ts`). You still need **`uvicorn` on port 8000** and **`npx cap sync ios`** after code changes. If it still shows demo data, run **`npm run cap:sync:local`** or set `VITE_API_BASE` explicitly.

If you run plain `npm run cap:sync` **without** that logic (older builds) or **without** syncing, relative `/api/...` URLs in the WebView do **not** hit your Mac → **demo mode**.

**Recommended for Simulator + backend on the same Mac:**

1. Start API: `uvicorn backend.main:app --reload --port 8000` (from repo root with venv active).
2. From repo root: **`npm run cap:sync:local`** — embeds `http://127.0.0.1:8000` in the JS bundle and syncs into Xcode.
3. Open Xcode: **`npm run cap:open`** — or use **`npm run ios:run`** to sync (local API) + open.

[`ios/App/App/Info.plist`](ios/App/App/Info.plist) already sets **`NSAllowsLocalNetworking`** so HTTP to your Mac works in the Simulator.

**Physical iPhone:** `127.0.0.1` is the phone, not your Mac. Use your Mac’s Wi‑Fi IP and bind the server to all interfaces:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Then rebuild with e.g. `VITE_API_BASE=http://192.168.x.x:8000 npm run build --prefix frontend && npx cap sync ios`, or put that URL in `frontend/.env.production.local` (gitignored) and run `npm run cap:sync`.

**TestFlight / App Store:** deploy the API behind **HTTPS**, set `VITE_API_BASE=https://your-api…`, then `npm run cap:sync` (or build + `npx cap sync ios`).

## Prerequisites

- **macOS** with **Xcode** (App Store) + Command Line Tools  
- **Node.js** + npm  
- **CocoaPods**: `sudo gem install cocoapods` or `brew install cocoapods`

All CLI commands below run from **`Ali-hacktathon/`** (repo root), not `frontend/`.

## One-time setup

```bash
cd /path/to/Ali-hacktathon
npm install
cd frontend && npm install && cd ..
```

If `ios/` does not exist yet:

```bash
npx cap add ios
```

## Build web assets + sync into Xcode

```bash
# Simulator on Mac + FastAPI on localhost:8000 (full API — use this for real features)
npm run cap:sync:local

# Or: custom URL (HTTPS prod, or LAN IP for a physical device)
# VITE_API_BASE=http://YOUR_HOST:8000 npm run build --prefix frontend && npx cap sync ios

# Plain sync (only if VITE_API_BASE is set in frontend/.env.production.local)
npm run cap:sync
```

This runs `vite build` in `frontend/` and copies output into the iOS app’s web assets.

## Open in Xcode

```bash
npm run cap:open
```

Open **`ios/App/App.xcodeproj`** (double‑click in Finder). Capacitor 8 + SPM may **not** create `App.xcworkspace`; the `.xcodeproj` is the correct entry point here. Select a Simulator or your iPhone, choose your **Signing Team**, press **Run**.

This template uses **Swift Package Manager** (`CapApp-SPM`). You only need CocoaPods/`pod install` if you add Cordova-style pods later.

## API URL on device

See **[Full backend in Xcode](#full-backend-in-xcode-not-demo-only)** above. Summary:

- **Simulator:** `npm run cap:sync:local` → `http://127.0.0.1:8000`.
- **Production / TestFlight:** deploy FastAPI behind **HTTPS**, then:

```bash
cd frontend && VITE_API_BASE=https://your-api.example.com npm run build && cd .. && npx cap sync ios
```

Rebuild in Xcode after every sync.

## Live reload (optional dev)

Add to `capacitor.config.json` (remove before store release):

```json
"server": {
  "url": "http://YOUR_MAC_LAN_IP:5173",
  "cleartext": true
}
```

Run `npm run dev` in `frontend/` on the Mac. Then `npx cap run ios`.

## Ship to TestFlight

1. Xcode → **Product → Archive**  
2. **Distribute App** → App Store Connect  
3. App Store Connect → **TestFlight** → add testers  

Bundle ID must match `appId` in `capacitor.config.json` (`com.joaquinparra.ruralpricing` unless you changed it).

After pulling changes that add Capacitor plugins (e.g. **Local Notifications** for the bell), run **`npm install`** at the repo root and **`npx cap sync ios`** before building in Xcode.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank white screen | Ensure `vite.config.ts` uses `base: './'` and run `npm run cap:sync` again. |
| `Missing appId` | Run `npx cap` commands from **repo root** where `capacitor.config.json` lives. |
| API fails on phone | Use Mac LAN IP + `uvicorn --host 0.0.0.0` + `VITE_API_BASE=http://…`; release needs HTTPS. |
| Only demo data in Xcode | Run **`npm run cap:sync`** after pulling fixes; **`uvicorn` must be on :8000**. If the banner shows **API —** (empty), the bundle isn’t seeing Capacitor — sync again. **Physical device:** use Mac LAN IP in **`VITE_API_BASE`**. |
