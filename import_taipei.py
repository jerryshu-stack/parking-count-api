"""Import Taipei City's open parking data into results.json.

Two feeds are joined on the car park id: one carries the static description
(including TWD97 coordinates), the other the live vacancy count. Re-running this
replaces the previously imported rows instead of duplicating them, so it is safe
to run on a schedule. Rows uploaded through the API are never touched.

    PARKING_API_KEY=x .venv/bin/python import_taipei.py
"""

import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from twd97 import to_wgs84

DESC_URL = "https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json"
AVAIL_URL = "https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json"

RESULTS_FILE = Path(__file__).parent / "results.json"
SOURCE = "taipei-open-data"

# Taipei City, with a little slack. Rejects the handful of rows whose TWD97
# coordinates are corrupt (some land thousands of kilometres away).
LAT_RANGE = (24.95, 25.22)
LON_RANGE = (121.45, 121.68)

TAIPEI = timezone(timedelta(hours=8))


def fetch(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.loads(response.read())["data"]


def parse_update_time(value: str) -> str:
    """'Sat Sep 12 17:18:00 CST 2026' -> '2026-09-12T09:18:00Z'.

    The feed labels its timestamps CST, meaning UTC+8 here, not US Central.
    """
    cleaned = value.replace(" CST ", " ")
    local = datetime.strptime(cleaned, "%a %b %d %H:%M:%S %Y").replace(tzinfo=TAIPEI)
    return local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_rows() -> tuple:
    desc = fetch(DESC_URL)
    avail = fetch(AVAIL_URL)

    timestamp = parse_update_time(desc["UPDATETIME"])
    vacancy = {p["id"]: p for p in avail["park"]}

    rows, skipped = [], {
        "coord": 0, "bounds": 0, "no_vacancy": 0, "no_data": 0,
        "no_car_capacity": 0, "exceeds_capacity": 0,
    }
    for park in desc["park"]:
        try:
            lat, lon = to_wgs84(float(park["tw97x"]), float(park["tw97y"]))
        except (KeyError, TypeError, ValueError):
            skipped["coord"] += 1
            continue

        if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
            skipped["bounds"] += 1
            continue

        live = vacancy.get(park["id"])
        if live is None:
            skipped["no_vacancy"] += 1
            continue

        count = live.get("availablecar")
        # The feed uses -9 to mean "no reading", which is not a vacancy of -9.
        if not isinstance(count, int) or count < 0:
            skipped["no_data"] += 1
            continue

        # Cross-check the live count against the declared car capacity. The source
        # publishes some impossible rows (one reports 900 free of 6 total), and some
        # bus/motorcycle-only sites where availablecar does not describe cars at all.
        capacity = park.get("totalcar")
        if not isinstance(capacity, int) or capacity <= 0:
            skipped["no_car_capacity"] += 1
            continue
        if count > capacity:
            skipped["exceeds_capacity"] += 1
            continue

        rows.append({
            "count": count,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "timestamp": timestamp,
            "name": park.get("name", ""),
            # Free-text fee description straight from the feed. FareInfo holds a
            # structured version but covers only ~60% of rows and splits each site
            # into several time-banded rules, so it does not reduce to one number.
            "price": (park.get("payex") or "").strip(),
            "total": capacity,
            "source": SOURCE,
        })

    return rows, skipped, timestamp


def main() -> None:
    rows, skipped, timestamp = build_rows()

    existing = json.loads(RESULTS_FILE.read_text()) if RESULTS_FILE.exists() else []
    kept = [r for r in existing if r.get("source") != SOURCE]

    merged = kept + rows
    merged.sort(key=lambda r: r["timestamp"])
    RESULTS_FILE.write_text(json.dumps(merged, indent=2, ensure_ascii=False))

    print(f"feed updated at {timestamp}")
    print(f"imported {len(rows)} car parks")
    print(f"skipped  {skipped}")
    print(f"kept     {len(kept)} local rows; total now {len(merged)}")


if __name__ == "__main__":
    main()
