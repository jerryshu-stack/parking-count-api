"""Seed 50 fake 'photo' (民眾分享) parking spots scattered around Taipei, for
trying out the map UI with more than the 4 real test uploads that exist today.

Reuses the two real photos already in images/ (randomly assigned) rather than
generating placeholder images -- this is throwaway demo data, not meant to look
like a real photo audit trail.

    DATABASE_URL=postgresql+psycopg://localhost/parking .venv/bin/python seed_photo_spots.py
"""

import random
from datetime import datetime, timedelta, timezone

from geoalchemy2.elements import WKTElement

from db import SessionLocal
from db_models import ParkingSpot

# Same bounding box import_taipei.py validates against -- Taipei City is basically
# all land in this range, so a plain random sample (not district-centre scatter) is fine.
LAT_RANGE = (24.95, 25.22)
LON_RANGE = (121.45, 121.68)

EXISTING_IMAGES = [
    "bffc7e9c69c5497e9e3011e2d672595d.jpg",
    "2288230abf954507b3e987405205d6f1.jpg",
]

COUNT = 50


def main() -> None:
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        for _ in range(COUNT):
            lat = round(random.uniform(*LAT_RANGE), 6)
            lon = round(random.uniform(*LON_RANGE), 6)
            recorded_at = now - timedelta(minutes=random.uniform(0, 90))
            db.add(
                ParkingSpot(
                    source="photo",
                    count=random.randint(0, 8),
                    latitude=lat,
                    longitude=lon,
                    location=WKTElement(f"POINT({lon} {lat})", srid=4326),
                    recorded_at=recorded_at,
                    image_filename=random.choice(EXISTING_IMAGES),
                    uploaded_by=None,  # demo data, not a real report
                )
            )
        db.commit()

    print(f"inserted {COUNT} fake photo spots")


if __name__ == "__main__":
    main()
