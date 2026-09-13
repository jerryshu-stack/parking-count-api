"""One-off migration: load the existing results.json into Postgres.

Run once, after schema.sql has been applied:

    .venv/bin/python migrate_to_postgres.py

Images on disk under images/ are left untouched -- parking_spots.image_filename
just references them by name, same as results.json did.
"""

import json
from pathlib import Path

from geoalchemy2.elements import WKTElement

from db import SessionLocal
from db_models import ParkingSpot

RESULTS_FILE = Path(__file__).parent / "results.json"


def main() -> None:
    rows = json.loads(RESULTS_FILE.read_text()) if RESULTS_FILE.exists() else []
    print(f"read {len(rows)} rows from {RESULTS_FILE}")

    inserted = 0
    with SessionLocal() as db:
        for row in rows:
            lat = row["latitude"]
            lon = row["longitude"]
            db.add(
                ParkingSpot(
                    source=row.get("source") or "photo",
                    count=row["count"],
                    latitude=lat,
                    longitude=lon,
                    location=WKTElement(f"POINT({lon} {lat})", srid=4326),
                    recorded_at=row["timestamp"],
                    name=row.get("name") or "",
                    price=row.get("price") or "",
                    total=row.get("total"),
                    image_filename=row.get("image"),
                    uploaded_by=None,  # no account system existed when these rows were created
                )
            )
            inserted += 1
        db.commit()

    print(f"inserted {inserted} rows into parking_spots")


if __name__ == "__main__":
    main()
