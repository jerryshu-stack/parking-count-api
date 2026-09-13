# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A parking-space counter with a membership/points economy layered on top. A phone uploads a photo
plus coordinates; a vision model (running on someone else's machine, not this one -- see "The
model" below) counts the empty spaces; the result is stored in Postgres, queryable by radius via
PostGIS. Taipei City's open parking feed is imported alongside those readings and kept fresh by a
background thread. Uploading successfully earns points; viewing other people's photo reports costs
points and only lasts a limited time -- see "Accounts, sessions, and points" below.

No queue, no Docker, no Alembic. Keep additions minimal and justified -- this grew from a genuine
proof-of-concept and should stay easy to reason about as it grows further.

## Running

Dependencies live in a local venv (`.venv/`), not on the system Python. Needs **Python 3.10+**
(the codebase uses `int | None` union syntax) -- on this machine that means Homebrew's Python, not
the system one:

```bash
/opt/homebrew/bin/python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Needs a running PostgreSQL with PostGIS (see "Storage" below for how it was set up locally), and
several environment variables:

```bash
DATABASE_URL=postgresql+psycopg://localhost/parking \
PARKING_API_KEY='<key>' \
REMOTE_MODEL_URL='https://xxxx.trycloudflare.com/' \
REMOTE_MODEL_API_KEY='<the remote model host's key>' \
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

`PARKING_API_KEY`, `REMOTE_MODEL_URL`, `REMOTE_MODEL_API_KEY` are all read at **import time** by
`auth.py` / `model.py` -- they raise `RuntimeError` if unset, so even a throwaway import needs them
set:

```bash
DATABASE_URL=... PARKING_API_KEY=x REMOTE_MODEL_URL=x REMOTE_MODEL_API_KEY=x \
  .venv/bin/python -c "from main import app"
```

Optional overrides, all with sane defaults if unset: `UPLOAD_REWARD` (4), `PHOTO_UNLOCK_COST` (2),
`PHOTO_UNLOCK_SECONDS` (60), `TAIPEI_IMPORT_INTERVAL_MINUTES` (30).

The server binds loopback only. Public access is a Cloudflare quick tunnel, run separately:

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

The tunnel URL is random and changes on every restart. It is hard-coded in `api-spec.html`, which
must be updated by hand when it changes -- and `api-spec.html` is also now stale relative to this
file (the `/nearby` response shape, the new auth/points endpoints); sync it before treating it as
current documentation for anyone outside this repo.

## The model

**The vision model does not run on this machine.** `model.py` is a thin HTTP client: it POSTs the
uploaded image to someone else's copy of this same API (`REMOTE_MODEL_URL` + `REMOTE_MODEL_API_KEY`,
their `/upload` endpoint) with dummy `latitude=0&longitude=0`, and returns their response's `count`
field. Whatever record they persist on their own side is irrelevant here -- only the count is used.
This is a deliberate, pragmatic split: their machine has Ollama + `qwen3-vl:32b` available, ours
doesn't need to.

`count_parking_spaces(image: bytes) -> int` is still the only contract `main.py` depends on. When
the model moves somewhere under our own control (e.g. the cloud), this is the only function that
needs to change -- `main.py`, the database schema, and the frontend are all unaffected.

If you ever need the *actual* local-Ollama implementation back (for testing without the remote
dependency), the old version prefilled the assistant turn with a closed `<think>` block to force
`qwen3-vl` to skip its chain-of-thought and answer immediately -- check git history for `model.py`
before this change if you need to resurrect it.

## Storage

Postgres + PostGIS, not `results.json` -- the switch happened because a whole-file
read-modify-write can't give correct concurrent point-spending, and a Python-side haversine loop
over every row doesn't scale to nationwide parking data. Local setup on this machine:

```bash
brew install postgresql postgis
brew services start postgresql@18
createdb parking
psql parking -f schema.sql
```

`schema.sql` is the only source of truth for the schema -- there is no Alembic. It's created fresh
each time (`CREATE TABLE`, not `CREATE TABLE IF NOT EXISTS`), so it's meant to be run once against
an empty database. Add a real migration tool the first time an *existing* database needs a schema
change; don't reach for one preemptively.

Five tables:

* **`users`** -- `points_balance` (CHECK >= 0), `photo_unlock_until` (server-authoritative unlock
  expiry, NULL = not unlocked).
* **`auth_credentials`** -- deliberately separate from `users` so Google/Apple/phone sign-in can be
  added later as new rows (same or new `user_id`, for account linking) without touching `users` or
  existing data. `provider` is `'password'` today; `provider_subject` is the lowercased username.
* **`sessions`** -- opaque bearer tokens. Only `sha256(token)` is stored as the primary key, never
  the raw token (same reasoning as password hashing) -- there's no `expires_at`, sessions live until
  an explicit logout (`revoked_at` set).
* **`parking_spots`** -- replaces `results.json`. Has a real `id` (the old model's only identity was
  coordinate equality within `COORD_TOLERANCE`, which is why `/image` and `DELETE /results` still
  match by coordinate for backward compatibility, but internally everything now has a proper PK).
  `location GEOGRAPHY(POINT,4326)` carries a GiST index (`parking_spots_location_gix`) that
  `/nearby` queries via `ST_DWithin`/`ST_Distance` -- this is what replaced the O(n) Python
  haversine loop.
* **`points_ledger`** -- every balance change (+4 upload reward, -2 unlock spend, +4 welcome grant)
  is one row here, not just a mutated integer. `related_spot_id` has `ON DELETE SET NULL` -- this
  bit once, in development: deleting a `parking_spots` row that a ledger entry pointed at threw a
  `ForeignKeyViolation` before that was added. If you add more FKs into `parking_spots`, decide the
  `ON DELETE` behavior deliberately; the default (`RESTRICT`) will surprise you the same way.

`migrate_to_postgres.py` was the one-off script that moved the original 1057 `results.json` rows
in; `seed_photo_spots.py` scatters extra fake `photo` rows (reusing the two real images already in
`images/`) for trying out the map UI with more than a handful of pins. Neither needs to be run
again in the ordinary course of things.

`images/` still holds real files on disk, referenced by `parking_spots.image_filename` -- moving to
Postgres did not change this; storing binary blobs in the database would be worse for this use
case, not better.

## Two kinds of record

`parking_spots` holds rows from two origins, distinguished by `source`:

* `"photo"` -- uploaded image, count produced by the (remote) vision model, `image_filename` set.
* `"taipei-open-data"` -- imported from the city feed, count is their sensor reading, no image.

`name`, `price` and `total` are **always present, possibly blank** on both -- `total` defaults to
`NULL`, deliberately not `0` (zero would read as "no spaces here" and would divide by zero in any
occupancy calculation). `uploaded_by` is only ever set for `photo` rows created through `/upload`
after the auth system existed -- rows migrated from before that (the 4 original test uploads) have
`uploaded_by = NULL` and there is no way to recover who made them.

## Accounts, sessions, and points

Registration/login is username + password today (`auth.py`), deliberately structured
(`auth_credentials` separate from `users`) so Google/Apple/phone sign-in can be added later without
a schema change. Sessions are opaque random tokens (`secrets.token_hex(32)`), not JWTs -- revoking
one is a plain `UPDATE sessions SET revoked_at = ...`, which a signed JWT can't do without a
separate denylist anyway. The frontend sends `Authorization: Bearer <token>`; this is layered
**on top of**, not instead of, the existing device-level `X-API-Key` -- a route can require either,
both, or neither.

New accounts get `WELCOME_GRANT` (4) points automatically on `/auth/register`.

`/upload` now requires a logged-in user (`require_user`) in addition to `X-API-Key`. A successful
model call (no exception) is the entire approval process -- there is no manual moderation queue.
The uploader gets `UPLOAD_REWARD` (4) points, recorded in `points_ledger` with
`reason='upload_reward'` and `related_spot_id` pointing at the new row.

Viewing `source='photo'` records costs `PHOTO_UNLOCK_COST` (2) points and unlocks them for
`PHOTO_UNLOCK_SECONDS` (60), via `POST /photo/unlock` (`points.spend_points`, which does one atomic
`UPDATE ... WHERE points_balance + delta >= 0 RETURNING ...` -- if that returns no row, it raises
`InsufficientPoints`, mapped to HTTP 402). `users.photo_unlock_until` is the server-authoritative
expiry that `/nearby` and `/image` both check.

`/nearby` reflects the paywall two ways: `source='photo'` rows are excluded from `spots` entirely
when the caller isn't currently unlocked, and a separate `locked_photo_count` field reports how
many exist in range *without revealing their data* -- this is what lets the frontend show a
"民眾拍照 (N)" button before payment. `/image` enforces the same rule directly (402, not 404, when
a `photo` record exists but the caller hasn't paid) -- this exists specifically to stop someone
bypassing the paywall by guessing/replaying a known coordinate straight against `/image` without
ever calling `/nearby`.

`GET /results` and `DELETE /results` (used by the `index.html` demo page) are intentionally **not**
folded into the user-auth system -- they stay `X-API-Key`-only, since that page is an
operator-facing tool, not part of the public paywall surface.

## Importing Taipei's open data

`import_taipei.py` joins two public feeds on car park id -- `TCMSV_alldesc.json` (static
description, TWD97 coordinates) and `TCMSV_allavailable.json` (live vacancy). `run_import()` is the
reusable entry point: it deletes every row with `source == 'taipei-open-data'` and inserts a fresh
set inside one transaction, so a concurrent `/nearby` query never observes a moment with zero
open-data rows. `main.py`'s `if __name__ == "__main__"` block still lets you run it by hand:

```bash
DATABASE_URL=... .venv/bin/python import_taipei.py
```

...but it also now runs automatically: `main.py` starts a daemon background thread on startup that
calls `run_import()` on a loop, sleeping `TAIPEI_IMPORT_INTERVAL_MINUTES` (default 30) between
runs. A feed hiccup is caught and logged, never allowed to take the API process down. Adjust the
interval by setting that env var when starting uvicorn -- no code change needed.

Of ~1770 listed car parks, the exact number that import successfully shifts run to run (the
vacancy feed updates every few minutes, so which rows fail the capacity cross-check changes with
it) -- don't treat any particular count as fixed in tests. See the validity filters in
`build_rows()` for why rows get dropped (bounds check, `-9` "no reading" sentinel, `availablecar >
totalcar` impossible rows, bus/motorcycle-only sites with `totalcar <= 0`).

## Coordinates: TWD97, not lat/lon

Unchanged by the Postgres migration. The feed publishes `tw97x`/`tw97y` -- TWD97 TM2 (EPSG:3826)
easting/northing as *strings*. `twd97.py` converts them with a pure-stdlib inverse transverse
Mercator (GRS80, central meridian 121°E, k0 = 0.9999, false easting 250000). Do not add `pyproj`
for this.

Validation, if you touch that file:

* **Round-trip** -- `from_wgs84` exists only as a test aid. Over 2000 random Taipei points the
  round-trip error is under 0.1 mm. This catches algebra errors but not a wrong datum.
* **Ground truth** -- 1189 rows in `TCMSV_alldesc.json` carry an `EntranceCoord` block holding
  real WGS84. Note the naming trap: **`Xcod` is latitude, `Ycod` is longitude.** Converted
  coordinates land a median 29.6 m from these, 91% within 100 m -- expected, since `tw97x/y` is the
  lot centroid and `EntranceCoord` the entrance, so don't chase that residual to zero.

A few rows have corrupt coordinates that convert to points thousands of kilometres away, so the
importer bounds-checks against Taipei City (lat 24.95-25.22, lon 121.45-121.68) -- `seed_photo_spots.py`
reuses the same bounding box to scatter its fake rows.

## Ordering (easy to get wrong)

* `GET /results` returns oldest first (`ORDER BY recorded_at ASC`).
* `GET /nearby` returns nearest first (`ORDER BY distance_m ASC` from the `ST_Distance` query).
* `GET /image` picks the highest-`id` (i.e. most recently inserted) row matching the coordinate --
  this replaced the old "last in append-ordered file" logic now that rows have a real PK.

`index.html` reverses `/results` before rendering but not `/nearby`. Any new consumer needs the
same care.

## Endpoints

| Endpoint | `X-API-Key` | `Authorization: Bearer` |
|---|---|---|
| `GET /` | no (only unauthenticated route -- a browser can't send a custom header on page load) | no |
| `POST /auth/register`, `POST /auth/login` | yes | no (don't have a token yet) |
| `POST /auth/logout`, `GET /me` | yes | yes |
| `POST /upload` | yes | yes (credits the uploader) |
| `GET /nearby`, `GET /image` | yes | yes (gates `photo` rows/402) |
| `POST /photo/unlock` | yes | yes |
| `GET /geocode` | yes | no (not user-specific) |
| `GET /results`, `DELETE /results` | yes | no (operator page, not part of the paywall) |

`GET /image` is the one endpoint that does not return JSON -- it streams raw image bytes with a
`Content-Type` inferred from the stored file's extension.

`GET /geocode` proxies OpenStreetMap Nominatim server-side. This exists because Nominatim's
response carries no CORS header -- a browser calling it directly gets a `TypeError` ("Failed to
fetch"), which is what the frontend used to surface as "連不上伺服器". Proxying also lets us send a
real `User-Agent`, which Nominatim's usage policy asks for and browsers won't let JS set. Rate
limit (max 1 req/sec, no autocomplete-on-keystroke) is still the frontend's responsibility to
respect -- this endpoint doesn't enforce it server-side.

Because `GET /` is public, the API key must never be baked into `index.html`. The page prompts for
it and keeps it in `localStorage`.

## Frontend

`index.html` is a single static file with no build step -- edit and reload, no server restart
needed (`FileResponse` re-reads it per request). It predates the auth system and is not part of
it: it's an operator/demo tool authenticated by `X-API-Key` alone, with no concept of logged-in
users or points. Coordinates are fixed constants at the top of its `<script>`:

```javascript
const LATITUDE  = 25.0330;
const LONGITUDE = 121.5654;
```

The real end-user frontend is the separate `parking` repo (React/Vite), which does implement the
full login/points/paywall UI against this API.

## api-spec.html

The consumer-facing API reference, published as a Claude artifact at
`https://claude.ai/code/artifact/e0b0c0f2-1e05-494c-b2ea-fcf1c92f8a87`. Republish to that same
URL rather than creating a new one. **Currently stale** relative to this file -- the `/nearby`
response shape changed (array -> `{spots, locked_photo_count}`), and the auth/points/geocode
endpoints aren't documented there yet. Update it before treating it as current.

Two constraints specific to this file:

* **No API key, ever** -- it uses `<API_KEY>` as a placeholder. The artifact may be shared.
* **ASCII only** -- the file has no `<meta charset>` (the artifact wrapper supplies `<head>`), so
  non-ASCII punctuation mojibakes when rendered outside that wrapper. Use HTML entities
  (`&mdash;`, `&rarr;`, `&middot;`).

## Testing

There is no test suite. Verify by curl against a running server:

```bash
B=http://127.0.0.1:8000; K='<PARKING_API_KEY>'

# register + login
curl -s -X POST "$B/auth/register" -H "X-API-Key: $K" -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"pw123456"}'
T=$(curl -s -X POST "$B/auth/login" -H "X-API-Key: $K" -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"pw123456"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

curl -s "$B/me" -H "X-API-Key: $K" -H "Authorization: Bearer $T"

curl -X POST "$B/upload" -H "X-API-Key: $K" -H "Authorization: Bearer $T" \
  -F "image=@photo.jpg" -F "latitude=25.0330" -F "longitude=121.5654"

curl -G "$B/nearby" -H "X-API-Key: $K" -H "Authorization: Bearer $T" \
  -d latitude=25.0330 -d longitude=121.5654 -d radius=1000

curl -X POST "$B/photo/unlock" -H "X-API-Key: $K" -H "Authorization: Bearer $T"

curl -G "$B/image" -H "X-API-Key: $K" -H "Authorization: Bearer $T" \
  -d latitude=25.0330 -d longitude=121.5654 -o out.jpg

curl -X DELETE -G "$B/results" -H "X-API-Key: $K" \
  -d latitude=25.0330 -d longitude=121.5654
```

This shell is zsh, which does **not** word-split unquoted expansions. `set -- $pair` inside a
loop assigns the whole string to `$1` and leaves `$2` empty, which silently turns a `DELETE` into
a malformed request. Write the coordinates out per call, or use `${=pair}`.

When restarting the server, do not poll the port to decide it is ready: the **old** process is
still listening for a moment after `pkill`, so the probe passes against the process that is
about to die and the next request hits nothing. Check that the PID changed instead.

`distance_m`-style checks now live in Postgres (`ST_Distance`), not a standalone Python function --
there's no `distance_m()` to unit-test directly anymore; verify radius queries against `/nearby`
end to end instead.

## Test data

`results.json` and its original test rows no longer exist as the source of truth (migrated into
Postgres, see "Storage"). What's in the database: ~1008 `taipei-open-data` rows (refreshed every
`TAIPEI_IMPORT_INTERVAL_MINUTES`), 4 original real-world `photo` uploads (2 from before image
storage existed, so they have no `image_filename`; 2 with real photos at Taipei 101), and 50
`seed_photo_spots.py` fake rows scattered around Taipei reusing those same 2 real images.

If you need more fake rows: scatter points from district centres (or, as `seed_photo_spots.py`
does, a plain bounding-box sample within Taipei City's bounds is fine too, since that box is
basically all land) rather than sampling all of Taiwan's bounding box -- over half of that is
ocean. Pillow is not a dependency and should not become one.
