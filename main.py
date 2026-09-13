import os
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

import import_taipei
from auth import (
    PHOTO_UNLOCK_COST,
    PHOTO_UNLOCK_SECONDS,
    optional_user,
    require_api_key,
    require_user,
)
from auth import router as auth_router
from db import get_db
from db_models import ParkingSpot, User
from model import count_parking_spaces
from points import InsufficientPoints, award_points, spend_points

INDEX_FILE = Path(__file__).parent / "index.html"
IMAGES_DIR = Path(__file__).parent / "images"
IMAGES_DIR.mkdir(exist_ok=True)

# Extensions we are willing to write to disk and serve back.
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic"}

SOURCE_PHOTO = "photo"

# Coordinates survive a round trip exactly, so this only absorbs float noise:
# 1e-6 degrees is about 11 cm.
COORD_TOLERANCE = 1e-6

UPLOAD_REWARD = int(os.environ.get("UPLOAD_REWARD", "4"))

# Contributing a photo is itself what opens community reports -- the product model is
# "share one photo, see what other drivers shared", not "earn a currency and then spend
# it". Points still accrue in the ledger exactly as before; they are just no longer the
# thing standing between a contributor and the data. 30 days by default.
CONTRIBUTION_UNLOCK_SECONDS = int(os.environ.get("CONTRIBUTION_UNLOCK_SECONDS", str(30 * 24 * 3600)))

# How often the Taipei open-data importer re-runs in the background. Adjust freely.
TAIPEI_IMPORT_INTERVAL_MINUTES = int(os.environ.get("TAIPEI_IMPORT_INTERVAL_MINUTES", "30"))

# Nominatim has no CORS header on its responses, so the browser can't call it directly
# (that's the "連不上伺服器" TypeError the frontend used to show) -- we proxy it server-side,
# which also lets us send a real User-Agent, which Nominatim's usage policy asks for and
# browsers refuse to let JS set.
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

app = FastAPI()
app.include_router(auth_router)


def _format_ts(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _spot_to_dict(spot: ParkingSpot) -> dict:
    return {
        "count": spot.count,
        "latitude": spot.latitude,
        "longitude": spot.longitude,
        "timestamp": _format_ts(spot.recorded_at),
        "name": spot.name,
        "price": spot.price,
        "total": spot.total,
        "source": spot.source,
        "image": spot.image_filename,
    }


def save_image(upload: UploadFile, contents: bytes) -> str:
    """Write the upload under a generated name and return that name."""
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        suffix = ".jpg"

    name = uuid.uuid4().hex + suffix
    (IMAGES_DIR / name).write_bytes(contents)
    return name


def _is_unlocked(user: User) -> bool:
    return user.photo_unlock_until is not None and user.photo_unlock_until > datetime.now(timezone.utc)


def _taipei_import_loop() -> None:
    while True:
        try:
            result = import_taipei.run_import()
            print(f"[taipei-import] imported {result['imported']} rows, skipped {result['skipped']}")
        except Exception as e:  # a feed hiccup should never take the API down
            print(f"[taipei-import] failed: {e!r}")
        time.sleep(TAIPEI_IMPORT_INTERVAL_MINUTES * 60)


@app.on_event("startup")
def start_taipei_import_thread() -> None:
    threading.Thread(target=_taipei_import_loop, daemon=True).start()


@app.get("/")
async def index():
    return FileResponse(INDEX_FILE)


@app.post("/upload", dependencies=[Depends(require_api_key)])
async def upload(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    name: str = Form(""),
    price: str = Form(""),
    total: int | None = Form(None),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    contents = await image.read()
    count = count_parking_spaces(contents)  # raises -> nothing below runs, no row, no points
    filename = save_image(image, contents)
    recorded_at = datetime.now(timezone.utc)

    spot = ParkingSpot(
        source=SOURCE_PHOTO,
        count=count,
        latitude=latitude,
        longitude=longitude,
        location=WKTElement(f"POINT({longitude} {latitude})", srid=4326),
        recorded_at=recorded_at,
        name=name,
        price=price,
        total=total,
        image_filename=filename,
        uploaded_by=user.id,
    )
    db.add(spot)
    db.flush()  # assigns spot.id for the ledger entry below

    balance = award_points(db, user, UPLOAD_REWARD, reason="upload_reward", related_spot_id=spot.id)

    unlock_until = datetime.now(timezone.utc) + timedelta(seconds=CONTRIBUTION_UNLOCK_SECONDS)
    if user.photo_unlock_until is None or user.photo_unlock_until < unlock_until:
        user.photo_unlock_until = unlock_until  # extend, never shorten an existing window
    db.commit()

    result = _spot_to_dict(spot)
    result["points_balance"] = balance
    result["points_awarded"] = UPLOAD_REWARD
    result["unlock_until"] = _format_ts(user.photo_unlock_until)
    return result


@app.get("/results", dependencies=[Depends(require_api_key)])
async def get_results(
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
):
    # The device key ships inside the mobile bundle, so it cannot be the only thing
    # guarding community rows -- otherwise this endpoint hands over exactly what
    # /nearby and /image charge for. Government rows stay open to any caller.
    query = select(ParkingSpot).order_by(ParkingSpot.recorded_at.asc())
    if user is None or not _is_unlocked(user):
        query = query.where(ParkingSpot.source != SOURCE_PHOTO)
    rows = db.execute(query).scalars().all()
    return [_spot_to_dict(r) for r in rows]


@app.get("/geocode", dependencies=[Depends(require_api_key)])
async def geocode(q: str = Query(..., min_length=1)):
    async with httpx.AsyncClient() as client:
        res = await client.get(
            NOMINATIM_URL,
            params={"q": q, "format": "jsonv2", "limit": 5, "countrycodes": "tw", "accept-language": "zh-TW"},
            headers={"User-Agent": "parking-map/1.0 (local dev, see project README)"},
            timeout=10,
        )
    res.raise_for_status()
    return res.json()


NEARBY_SQL = text(
    """
    SELECT count, latitude, longitude, recorded_at, name, price, total, image_filename, source,
           ST_Distance(location, ST_MakePoint(:lon, :lat)::geography) AS distance_m
    FROM parking_spots
    WHERE ST_DWithin(location, ST_MakePoint(:lon, :lat)::geography, :radius)
      AND (source != 'photo' OR :unlocked)
    ORDER BY distance_m ASC
    """
)

LOCKED_PHOTO_COUNT_SQL = text(
    """
    SELECT count(*) FROM parking_spots
    WHERE ST_DWithin(location, ST_MakePoint(:lon, :lat)::geography, :radius)
      AND source = 'photo'
    """
)


@app.get("/nearby", dependencies=[Depends(require_api_key)])
async def nearby(
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius: float = Query(..., ge=0, description="search radius in metres"),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    unlocked = _is_unlocked(user)
    rows = db.execute(
        NEARBY_SQL, {"lon": longitude, "lat": latitude, "radius": radius, "unlocked": unlocked}
    ).mappings().all()

    spots = [
        {
            "count": r["count"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "timestamp": _format_ts(r["recorded_at"]),
            "distance_m": round(r["distance_m"], 1),
            "name": r["name"],
            "price": r["price"],
            "total": r["total"],
            "source": r["source"],
            "image": r["image_filename"],
        }
        for r in rows
    ]

    locked_photo_count = 0
    if not unlocked:
        locked_photo_count = db.execute(
            LOCKED_PHOTO_COUNT_SQL, {"lon": longitude, "lat": latitude, "radius": radius}
        ).scalar_one()

    return {"spots": spots, "locked_photo_count": locked_photo_count}


@app.get("/image", dependencies=[Depends(require_api_key)])
async def get_image(
    latitude: float = Query(...),
    longitude: float = Query(...),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    spot = db.execute(
        select(ParkingSpot)
        .where(
            func.abs(ParkingSpot.latitude - latitude) <= COORD_TOLERANCE,
            func.abs(ParkingSpot.longitude - longitude) <= COORD_TOLERANCE,
        )
        .order_by(ParkingSpot.id.desc())
        .limit(1)
    ).scalar_one_or_none()

    if spot is None:
        raise HTTPException(status_code=404, detail="no record at this coordinate")

    if spot.source == SOURCE_PHOTO and not _is_unlocked(user):
        raise HTTPException(status_code=402, detail="spend points to view 民眾拍照 photos")

    if not spot.image_filename:
        raise HTTPException(status_code=404, detail="record has no stored image")

    path = IMAGES_DIR / spot.image_filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="record has no stored image")

    return FileResponse(path)


@app.delete("/results", dependencies=[Depends(require_api_key)])
async def delete_result(
    latitude: float = Query(...),
    longitude: float = Query(...),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    matches = db.execute(
        select(ParkingSpot).where(
            func.abs(ParkingSpot.latitude - latitude) <= COORD_TOLERANCE,
            func.abs(ParkingSpot.longitude - longitude) <= COORD_TOLERANCE,
        )
    ).scalars().all()

    for spot in matches:
        if spot.image_filename:
            (IMAGES_DIR / spot.image_filename).unlink(missing_ok=True)
        db.delete(spot)
    db.commit()

    remaining = db.execute(select(func.count()).select_from(ParkingSpot)).scalar_one()
    return {"deleted": len(matches), "remaining": remaining}


@app.get("/me/contributions", dependencies=[Depends(require_api_key)])
async def my_contributions(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
):
    """The caller's own photo reports, newest first.

    parking_spots.uploaded_by was already written on every upload but nothing read it.
    """
    rows = db.execute(
        select(ParkingSpot)
        .where(ParkingSpot.uploaded_by == user.id)
        .order_by(ParkingSpot.recorded_at.desc())
        .limit(limit)
    ).scalars().all()
    return [_spot_to_dict(r) for r in rows]


@app.post("/photo/unlock", dependencies=[Depends(require_api_key)])
async def unlock_photos(user: User = Depends(require_user), db: Session = Depends(get_db)):
    try:
        balance = spend_points(db, user, PHOTO_UNLOCK_COST, reason="photo_unlock")
    except InsufficientPoints:
        db.rollback()
        raise HTTPException(status_code=402, detail="insufficient points")

    unlock_until = datetime.now(timezone.utc) + timedelta(seconds=PHOTO_UNLOCK_SECONDS)
    user.photo_unlock_until = unlock_until
    db.commit()

    return {
        "points_balance": balance,
        "unlock_until": _format_ts(unlock_until),
        "unlocked_seconds": PHOTO_UNLOCK_SECONDS,
    }
