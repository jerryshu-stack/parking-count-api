# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A proof-of-concept parking-space counter. A phone uploads a photo plus coordinates; a local
vision model counts the empty spaces; the photo is kept and the result appended to a JSON file,
queryable by radius. Taipei City's open parking feed is imported alongside those readings.
Deliberately minimal — no database, no queue, no background workers, no Docker. Keep it that way
unless asked otherwise.

## Running

Dependencies live in a local venv (`.venv/`), not on the system Python.

```bash
.venv/bin/pip install -r requirements.txt

PARKING_API_KEY='<key>' .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

`PARKING_API_KEY` is read at **import time** — `main.py` raises `RuntimeError` if it is unset.
This means `from main import ...` fails in a bare shell too; set the variable even for a
throwaway import:

```bash
PARKING_API_KEY=x .venv/bin/python -c "from main import distance_m; print(distance_m(0,0,1,0))"
```

The server binds loopback only. Public access is a Cloudflare quick tunnel, run separately:

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

The tunnel URL is random and changes on every restart. It is hard-coded in `api-spec.html`,
which must be updated by hand when it changes.

## The model

`model.py` calls Ollama on localhost. It requires `ollama serve` to be running and the model
pulled: `ollama pull qwen3-vl:32b` (~20 GB).

The `PREFILL` constant is load-bearing, not a style choice. `qwen3-vl` is a thinking model with
no non-thinking variant on Ollama; `think=False` and `format=<json schema>` are both ignored by
its template. Left alone it spends thousands of tokens counting out loud and returns an empty
`content` while `done_reason` is `length`. Prefilling the assistant turn with a closed `<think>`
block plus the start of the answer sentence forces an immediate number — roughly 90 s down to
under 2 s. If you swap the model, re-test this: the fix is template-specific.

`count_parking_spaces(image: bytes) -> int` is the only contract `main.py` depends on. Replacing
the backend means rewriting that function and nothing else.

## Storage and its consequences

`results.json` is the entire database and `images/` holds the uploads. Every mutation is a full
read-modify-write of the JSON file, so two concurrent `POST`s can lose one of the writes. There
are no IDs; records are identified only by coordinate.

Each record carries an `image` field: a `uuid4` hex name plus the extension. The name is
generated, never the client's filename — and it must be generated, because timestamps are not
unique (several records can share one second, and the seeded test data shares a single
timestamp across every row).

`GET /image` returns the **last** matching record's photo, because records are stored oldest
first. Uploading twice at one coordinate therefore strands the older file: still on disk, no
longer reachable. `DELETE /results` unlinks the photos of every record it removes, so a delete
is not recoverable.

Records predating image storage have no `image` field; `.get("image")` guards this and the
endpoint answers 404 with `"record has no stored image"` rather than crashing.

`COORD_TOLERANCE` (1e-6 degrees, ~11 cm) is what makes `DELETE /results` work. JSON float
round-trips are exact, so exact equality would also match — the tolerance exists to absorb
noise from clients that recompute coordinates. It is far too tight to act as a radius search.

## Two kinds of record

`results.json` holds rows from two origins, distinguished by a `source` field:

Every record declares its origin in `source`, which is always present and never empty:

* `"photo"` — uploaded image, count produced by the vision model (`SOURCE_PHOTO` in `main.py`)
* `"taipei-open-data"` — imported from the city feed, count is their sensor reading (`SOURCE` in
  `import_taipei.py`)

| | `"photo"` | `"taipei-open-data"` |
|---|---|---|
| `image` | always set | absent |
| `name` | caller's value or `""` | car park name |
| `price` | caller's value or `""` | fee paragraph |
| `total` | caller's value or `null` | declared car capacity |
| `count` | model estimate | city sensor reading |

`name`, `price` and `total` are **always present, possibly blank** — `/upload` takes all three as
optional form fields. `total` defaults to `null`, deliberately not `0`: zero would read as "no
spaces here" and would divide by zero in any occupancy calculation. Check for content, not for
the key.

`image` is the only field that can genuinely be absent; `/image` answers 404 `"record has no
stored image"` for imported rows.

`count` and `total` are not cross-checked on upload — a caller may send a `total` below the
model's count and both are stored. Imported rows *are* checked; see below.

The two source constants are what makes the import idempotent: it deletes rows matching its own
`SOURCE` and leaves `"photo"` rows alone. Changing either string orphans the existing rows.

`price` is free text on both paths. Imported values are the feed's `payex` paragraph, up to about
300 characters, mixing hourly rates, monthly passes, motorcycle tariffs and night bands. The feed
also ships a structured `FareInfo`, but it covers only ~60% of rows and splits each site into
several time-banded rules, so it does not reduce to one number — that is why `price` is a string
and not a rate.

## Importing Taipei's open data

`import_taipei.py` joins two public feeds on car park id — `TCMSV_alldesc.json` (static
description, TWD97 coordinates) and `TCMSV_allavailable.json` (live vacancy). No key, no
registration. Run it any time; it is idempotent:

```bash
PARKING_API_KEY=x .venv/bin/python import_taipei.py
```

It deletes every row with `source == "taipei-open-data"` and writes a fresh set, so local uploads
survive but a `DELETE` against an imported coordinate reappears on the next run.

Of ~1770 listed car parks, ~1050 import. The exact number shifts between runs: the vacancy feed
updates every few minutes, so which rows fail the capacity cross-check changes with it. Do not
treat the import count as a fixed figure in tests. Rows are dropped when they have no live vacancy entry,
when they report the feed's `-9` sentinel for "no reading" (never store that as a count of -9),
and when the reading fails a cross-check against `totalcar`:

* `availablecar > totalcar` is impossible. The source publishes a handful anyway — one reports
  900 free spaces out of 6 — so those rows are dropped. `totalcar` is also what lands in the
  record's `total` field, so this check doubles as validation of that value.
* `totalcar <= 0` means the site declares no car capacity. These are bus and motorcycle parks
  where `availablecar` is not describing cars, so a car vacancy count is meaningless.

Both checks were added after the imported counts looked implausibly high. They were not: the
median vacancy ratio is 0.24 and 173 rows read zero, which is exactly what a remaining-spaces
field looks like. The real defect was those ~30 self-contradictory rows. If you ever suspect the
wrong field is being read, check the ratio — reading `totalcar` by mistake would make it 1.00
everywhere.

One row survives the checks but still looks wrong: a 1503-space site reporting 1501 free. That
is legal arithmetic, so it is kept; a "too empty" threshold would delete genuinely quiet lots.

All imported rows share one timestamp: the feed's `UPDATETIME`, parsed from
`"Sat Sep 12 17:18:00 CST 2026"`. **That `CST` is UTC+8, not US Central** — `strptime` cannot
parse it, so the literal is stripped before parsing and `timezone(timedelta(hours=8))` applied.

## Coordinates: TWD97, not lat/lon

The feed publishes `tw97x`/`tw97y` — TWD97 TM2 (EPSG:3826) easting/northing as *strings*.
`twd97.py` converts them with a pure-stdlib inverse transverse Mercator (GRS80, central meridian
121°E, k0 = 0.9999, false easting 250000). Do not add `pyproj` for this.

Validation, if you touch that file:

* **Round-trip** — `from_wgs84` exists only as a test aid. Over 2000 random Taipei points the
  round-trip error is under 0.1 mm. This catches algebra errors but not a wrong datum.
* **Ground truth** — 1189 rows in `TCMSV_alldesc.json` carry an `EntranceCoord` block holding
  real WGS84. Note the naming trap: **`Xcod` is latitude, `Ycod` is longitude.** Converted
  coordinates land a median 29.6 m from these, 91% within 100 m. That residual is expected —
  `tw97x/y` is the lot centroid, `EntranceCoord` the entrance — so do not chase it to zero.

Published landmark TWD97 values found by memory or casual search proved unreliable (a consistent
1.7 km offset against three of them while the projection was in fact correct). Use
`EntranceCoord`; it is same-source.

A few rows have corrupt coordinates that convert to points thousands of kilometres away, so the
importer bounds-checks against Taipei City (lat 24.95–25.22, lon 121.45–121.68).

## Ordering (easy to get wrong)

* `GET /results` returns **append order — oldest first**.
* `GET /nearby` returns **nearest first**, and adds a `distance_m` field.

`GET /image` depends on the first of these: it takes `matches[-1]`, which is only the newest
record while `results.json` stays in append order. Anything that reorders the file silently
changes which photo that endpoint serves.

`index.html` reverses `/results` before rendering but not `/nearby`. Any new consumer needs the
same care.

## Endpoints

`GET /image` is the one endpoint that does not return JSON — it streams raw image bytes with a
`Content-Type` inferred from the stored file's extension.

`GET /` serves `index.html` and is the **only unauthenticated route** — a browser cannot send
a custom header on a page load. Everything else requires `X-API-Key`, checked with
`secrets.compare_digest`.

Because the page is public, the key must never be baked into `index.html`. The page prompts for
it and keeps it in `localStorage`.

## Frontend

`index.html` is a single static file with no build step — edit and reload, no server restart
needed (`FileResponse` re-reads it per request). Coordinates are fixed constants at the top of
its `<script>`:

```javascript
const LATITUDE  = 25.0330;
const LONGITUDE = 121.5654;
```

## api-spec.html

The consumer-facing API reference, published as a Claude artifact at
`https://claude.ai/code/artifact/e0b0c0f2-1e05-494c-b2ea-fcf1c92f8a87`. Republish to that same
URL rather than creating a new one.

Two constraints specific to this file:

* **No API key, ever** — it uses `<API_KEY>` as a placeholder. The artifact may be shared.
* **ASCII only** — the file has no `<meta charset>` (the artifact wrapper supplies `<head>`), so
  non-ASCII punctuation mojibakes when rendered outside that wrapper. Use HTML entities
  (`&mdash;`, `&rarr;`, `&middot;`).

Keep it in sync when endpoints change.

## Testing

There is no test suite. Verify by curl against a running server:

```bash
K='<key>'; B=http://127.0.0.1:8000

curl -X POST "$B/upload" -H "X-API-Key: $K" \
  -F "image=@photo.jpg" -F "latitude=25.0330" -F "longitude=121.5654"

curl -G "$B/nearby" -H "X-API-Key: $K" \
  -d latitude=25.0330 -d longitude=121.5654 -d radius=1000

curl -G "$B/image" -H "X-API-Key: $K" \
  -d latitude=25.0330 -d longitude=121.5654 -o out.jpg

curl -X DELETE -G "$B/results" -H "X-API-Key: $K" \
  -d latitude=25.0330 -d longitude=121.5654
```

Back up `results.json` **and** `images/` before running delete tests — there is no undo, and
delete removes the photos too.

This shell is zsh, which does **not** word-split unquoted expansions. `set -- $pair` inside a
loop assigns the whole string to `$1` and leaves `$2` empty, which silently turns a `DELETE` into
a malformed request. Write the coordinates out per call, or use `${=pair}`.

The strongest check on `/image` is a byte comparison: fetch each record by its coordinate and
diff against `images/<its image field>`. Expect exactly one mismatch per coordinate that holds
more than one record — that is the newest-wins rule, not a bug.

When restarting the server, do not poll the port to decide it is ready: the **old** process is
still listening for a moment after `pkill`, so the probe passes against the process that is
about to die and the next request hits nothing. Check that the PID changed instead.

`distance_m` can be checked against published great-circle distances: London to Paris is
343.6 km and New York to Los Angeles is 3935.8 km under this spherical model.

## Test data

The seeded placeholder rows and their colour-swatch PNGs have been deleted. What remains
alongside the imported feed is two real phone uploads at Taipei 101, kept for their counts; their
photos were lost because they arrived before image storage existed, so their `image` field was
stripped rather than left pointing at a placeholder.

If you need fake rows again: scatter points from district centres with a small random offset
rather than sampling a lat/lon bounding box — over half of Taiwan's bounding box is ocean. For
placeholder images, write PNGs with `zlib` and `struct` directly and give each a distinct hue
from a golden-angle sweep, so a wrong `/image` lookup is obvious at a glance. Pillow is not a
dependency and should not become one. The colours come from a golden-angle hue sweep so neighbouring records look nothing
alike — that is what makes a wrong `/image` lookup obvious at a glance. Generate such images
with `zlib` and `struct` directly; Pillow is not a dependency and should not become one.
