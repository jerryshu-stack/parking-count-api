# Parktogether — mobile app

Taiwanese parking discovery app. Government open data as the baseline; community
photo reports unlock once you contribute one of your own.

Expo (SDK 57) · React Native 0.86 · TypeScript · Expo Router. iOS first, Android supported.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how the app maps onto the backend and what
changed in the backend to support it.

## Running it

The app needs three things alive: Postgres, the API, and something that can count
parking spaces in a photo.

### 1. Database

```bash
brew install postgresql@17 postgis
brew services start postgresql@17
createdb parking
psql -d parking -f ../schema.sql
```

Load data — the Taipei open-data feed needs no key and refreshes itself every 30 minutes
once the API is running:

```bash
cd ..
DATABASE_URL=postgresql+psycopg:///parking PARKING_API_KEY=dev \
  .venv/bin/python import_taipei.py
```

### 2. Vision model

`model.py` posts each photo to a remote instance of this same API and reads back `count`.
For local development, `devtools/local_model_server.py` serves that contract from a local
Ollama:

```bash
ollama pull qwen3-vl:32b          # ~20 GB, once
.venv/bin/python devtools/local_model_server.py   # listens on :8100
```

### 3. API

```bash
cd ..
DATABASE_URL=postgresql+psycopg:///parking \
PARKING_API_KEY='<your key>' \
REMOTE_MODEL_URL=http://127.0.0.1:8100 \
REMOTE_MODEL_API_KEY=dev \
  .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` matters: a phone on the same Wi-Fi cannot reach `127.0.0.1`.

### 4. The app

```bash
cp .env.example .env     # then edit, see below
npm install
npm run ios              # or: npm run android
```

## Environment

`.env`, read through `app.config.ts`. Both values are baked into the JS bundle, so
`EXPO_PUBLIC_*` is the correct prefix and neither may hold anything genuinely secret.

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `http://<your-LAN-IP>:8000` on a real device. `127.0.0.1` only works in a simulator. |
| `EXPO_PUBLIC_API_KEY` | The backend's `PARKING_API_KEY`. Every route requires it, including `/auth/login`, so the app cannot function without shipping it — see ARCHITECTURE.md §7. |

The per-user session token is different: it lives in `expo-secure-store` (Keychain /
Android Keystore), never in the bundle and never in AsyncStorage.

## Layout

```
app/                     routes (expo-router)
  (auth)/sign-in         entry
  (tabs)/                地圖 · 回報 · 社群 · 我的
  spot/[key]             parking detail, both sources
  report/camera|review   contribution flow
src/
  api/                   typed client; the only place fetch is called
  theme/                 every colour, space, radius and type style
  components/            Text, Button, Divider, EmptyState, SourceLabel, Availability
  features/map/          MapCanvas (+ .web), markers, thinning, search, radius
  features/parking/      row, map preview
  hooks/                 location, nearby, spot, area names, tab bar height
  utils/                 Taiwanese formatting; Google Maps hand-off
```

## Notes

`MapCanvas.web.tsx` exists only so the UI can be rendered and reviewed on this machine,
which has no Xcode and therefore no iOS Simulator. It draws OSM raster tiles with the
standard Web Mercator transform so spacing and marker density can be judged honestly.
iOS and Android both load `MapCanvas.tsx`, which is Apple Maps via `react-native-maps`.

Two things do not work in a browser and are fine on device: community photo thumbnails
(`GET /image` needs request headers, and an `<img>` cannot send them), and reverse
geocoding for street names (falls back to a neutral label rather than showing raw
coordinates).
