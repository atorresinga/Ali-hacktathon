# iOS app (Capacitor)

Capacitor wraps the Vite/React build from [`frontend/`](frontend/). Config lives at the **repository root**: [`capacitor.config.json`](capacitor.config.json) (`webDir`: `frontend/dist`).

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
npm run cap:sync
```

This runs `vite build` in `frontend/` and copies output into `ios/App/App/public`.

## Open in Xcode

```bash
npm run cap:open
```

Open **`ios/App/App.xcodeproj`** (double‑click in Finder). Capacitor 8 + SPM may **not** create `App.xcworkspace`; the `.xcodeproj` is the correct entry point here. Select a Simulator or your iPhone, choose your **Signing Team**, press **Run**.

This template uses **Swift Package Manager** (`CapApp-SPM`). You only need CocoaPods/`pod install` if you add Cordova-style pods later.

## API URL on device

- **Simulator** can use `http://127.0.0.1:8000` if the backend runs on your Mac **only if** you configure App Transport Security exceptions (not ideal for release).
- **Production / TestFlight**: deploy FastAPI behind **HTTPS**, then build with:

```bash
cd frontend
VITE_API_BASE=https://your-api.example.com npm run build
cd ..
npm run cap:sync
```

Rebuild in Xcode after every `cap:sync`.

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

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank white screen | Ensure `vite.config.ts` uses `base: './'` and run `npm run cap:sync` again. |
| `Missing appId` | Run `npx cap` commands from **repo root** where `capacitor.config.json` lives. |
| API fails on phone | Use HTTPS + `VITE_API_BASE`; localhost is not reachable from a physical device. |
