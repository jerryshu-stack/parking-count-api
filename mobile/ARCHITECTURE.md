# Mobile ↔ backend architecture note

Written after reading `main.py`, `auth.py`, `points.py`, `db.py`, `db_models.py`,
`schema.sql`, `model.py`, `import_taipei.py`, `index.html` and `CLAUDE.md` at commit
`5eb3269`. The repository — not `api-spec.html`, which its own CLAUDE.md marks stale — is
the source of truth here.

## 1. Two independent credentials

The backend checks two unrelated things, and almost every route wants both.

| | Header | Checked by | Meaning |
|---|---|---|---|
| Device key | `X-API-Key` | `auth.require_api_key` | One shared string (`PARKING_API_KEY`). Gates the whole surface. |
| User session | `Authorization: Bearer <token>` | `auth.require_user` | Opaque 64-hex token; only its sha256 is stored in `sessions`. |

Session tokens have **no expiry column** — `require_user` only checks `revoked_at`. A token
stays valid until `/auth/logout`. The app therefore treats any `401` as "session gone" and
returns to the entry screen rather than trying to refresh.

## 2. Endpoint map as the app uses it

| Method | Path | Device key | Session | App uses it for |
|---|---|---|---|---|
| POST | `/auth/register` | ✅ | — | entry screen |
| POST | `/auth/login` | ✅ | — | entry screen |
| POST | `/auth/logout` | ✅ | ✅ | 我的 → 登出 |
| GET | `/me` | ✅ | ✅ | unlock state, session probe on cold start |
| GET | `/me/contributions` | ✅ | ✅ | 我的貢獻 — **added, see §5** |
| GET | `/nearby` | ✅ | ✅ | the map and 附近車位 sheet |
| GET | `/geocode` | ✅ | — | 搜尋目的地 |
| GET | `/image` | ✅ | ✅ | community photo bytes |
| POST | `/upload` | ✅ | ✅ | 送出回報 |

Deliberately **not** used by the app: `GET /results` (whole table, no pagination),
`DELETE /results`, `POST /photo/unlock` (see §5), and `GET /` (the old demo page).

## 3. Shapes that matter

`GET /nearby?latitude&longitude&radius` — radius in **metres**, `>= 0`:

```jsonc
{
  "spots": [{
    "count": 146,              // available spaces now
    "total": 536,              // capacity; null for community reports
    "latitude": 25.0486, "longitude": 121.5174,
    "timestamp": "2026-09-13T01:13:57Z",
    "distance_m": 412.3,
    "name": "京站停車場",       // "" when unknown
    "price": "計時：小型車…",    // free text, may be 300 chars, may be ""
    "source": "taipei-open-data" | "photo",
    "image": "a1b2….jpg" | null
  }],
  "locked_photo_count": 3      // >0 only while the user is locked
}
```

Two things the app must respect:

* **Photo rows are filtered server-side.** While locked, `spots` contains government rows
  only and `locked_photo_count` says how many were withheld. The app never needs to hide
  anything itself — it just renders the hint when the count is non-zero.
* `distance_m` is PostGIS `ST_Distance` on `geography`, so it is true metres on the
  ellipsoid. The app formats it, never recomputes it.

`GET /image?latitude&longitude` returns **raw image bytes**, not JSON, and matches by
coordinate within 1e-6° (~11 cm), newest row wins. `402` means locked, `404` means no row
or no file. Because it needs two headers, the app cannot hand a bare URL to `<Image>`; it
passes `source={{ uri, headers }}`.

`POST /upload` is `multipart/form-data`: `image` plus `latitude`, `longitude`, and optional
`name`, `price`, `total`. **The client never sends a count** — `count_parking_spaces()`
produces it. The response is the stored row plus `points_balance` / `points_awarded`.

`GET /geocode?q=` proxies Nominatim and returns its raw `jsonv2` array (`lat`/`lon` are
**strings**, `display_name` is long and comma-heavy). The app parses and shortens it.

## 4. Where the backend and the product brief disagree

**The unlock mechanic was the real mismatch.** The brief is "contribute a photo → community
reports open up". The backend instead implemented a currency: `/upload` awards
`UPLOAD_REWARD` (4) points, and unlocking is a *separate* purchase — `POST /photo/unlock`
spends `PHOTO_UNLOCK_COST` (2) and sets `photo_unlock_until` to **60 seconds** out.

So as written, contributing does not unlock anything; it buys tokens the user must then
spend, and the window expires before they could read a single result. Surfacing that flow
would also mean surfacing balances and prices — the points-heavy UI the brief rules out.

## 5. Backend changes made

Four changes, each the smallest thing that made the product behave as specified. The points
ledger, schema, auth model and importer are untouched.

1. **`/upload` grants the unlock directly** (`main.py`). After the existing
   `award_points(...)` call, the upload extends `photo_unlock_until` by
   `CONTRIBUTION_UNLOCK_SECONDS` (default 30 days). Points still accrue exactly as before —
   they are simply no longer the thing standing between a contributor and the data. This is
   what makes 「分享一張照片 → 解鎖社群回報」 literally true.

2. **`/results` no longer leaks community rows** (`main.py`). It was device-key-only and
   returned every `photo` row unfiltered, so the same key the app must ship would hand over
   exactly what the gate protects. It now takes an *optional* session and applies the same
   rule as `/nearby`: government rows always, photo rows only when unlocked. Callers without
   a session still work and still get government data.

3. **`DELETE /results` now requires a session** (`main.py`). It previously let anyone holding
   the device key delete any record and unlink its photo. The app never calls it; this just
   stops the shipped key from being a delete-anything credential.

4. **`GET /me/contributions` added** (`main.py`). 我的貢獻 needs the caller's own rows and
   nothing existed to serve them — `parking_spots.uploaded_by` was written but never read.
   Returns that user's photo rows, newest first.

`api-spec.html` is left alone; it was already marked stale by its own documentation and
documents a version of the API that no longer exists.

## 6. Local development shim for the vision model

`model.py` posts the photo to a *remote* instance of this same API
(`REMOTE_MODEL_URL`/`REMOTE_MODEL_API_KEY`) and reads back `count`. Nothing in this checkout
can serve that, so `/upload` would 500 on a clean machine.

`devtools/local_model_server.py` speaks exactly that contract against the Ollama +
`qwen3-vl:32b` already installed here, reusing the closed-`<think>` prefill from the
original `model.py`. Point `REMOTE_MODEL_URL` at it and uploads return real model counts.
`model.py` itself is unchanged, so production still talks to whatever remote instance it is
configured for.

## 7. Credential handling in the app

Every route needs the device key, including `/auth/login` — so the app has no way to reach
the backend without shipping it. It is read from `EXPO_PUBLIC_API_KEY` through
`app.config.ts` rather than written into any source file, but an `EXPO_PUBLIC_*` value is
embedded in the JS bundle and is extractable from any build. It is a device key, not a
secret, and change 2 and 3 above are what stop it from being more than that.

The session token is different: it is per-user and is kept in `expo-secure-store`
(Keychain / Android Keystore), never in AsyncStorage.
