"""Import Taipei City's open parking data into Postgres.

Two feeds are joined on the car park id: one carries the static description
(including TWD97 coordinates), the other the live vacancy count. Re-running this
replaces the previously imported rows instead of duplicating them, so it is safe
to run on a schedule -- main.py does exactly that in a background thread. Rows
uploaded through the API (source='photo') are never touched.

    PARKING_API_KEY=x .venv/bin/python import_taipei.py
"""

import urllib.request
import json
from datetime import datetime, timedelta, timezone

from geoalchemy2.elements import WKTElement
from sqlalchemy import delete

from db import SessionLocal
from db_models import ParkingSpot
from twd97 import to_wgs84

DESC_URL = "https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json"
AVAIL_URL = "https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json"

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


def run_import() -> dict:
    """Fetch, validate, and replace all taipei-open-data rows. Safe to call on a
    schedule -- delete+insert happens in one transaction, so a concurrent /nearby
    query never observes a moment with zero open-data rows."""
    rows, skipped, timestamp = build_rows()

    with SessionLocal() as db:
        db.execute(delete(ParkingSpot).where(ParkingSpot.source == SOURCE))
        for row in rows:
            db.add(
                ParkingSpot(
                    source=SOURCE,
                    count=row["count"],
                    latitude=row["latitude"],
                    longitude=row["longitude"],
                    location=WKTElement(f"POINT({row['longitude']} {row['latitude']})", srid=4326),
                    recorded_at=row["timestamp"],
                    name=row["name"],
                    price=row["price"],
                    total=row["total"],
                )
            )
        db.commit()

    return {"timestamp": timestamp, "imported": len(rows), "skipped": skipped}


def main() -> None:
    result = run_import()
    print(f"feed updated at {result['timestamp']}")
    print(f"imported {result['imported']} car parks")
    print(f"skipped  {result['skipped']}")


if __name__ == "__main__":
    main()
