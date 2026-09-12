import json
import math
import os
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from model import count_parking_spaces

RESULTS_FILE = Path(__file__).parent / "results.json"
INDEX_FILE = Path(__file__).parent / "index.html"
IMAGES_DIR = Path(__file__).parent / "images"
IMAGES_DIR.mkdir(exist_ok=True)

# Extensions we are willing to write to disk and serve back.
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic"}

# Every record says where its count came from. Imported rows carry their own
# source string; see import_taipei.py.
SOURCE_PHOTO = "photo"

API_KEY = os.environ.get("PARKING_API_KEY")
if not API_KEY:
    raise RuntimeError("PARKING_API_KEY environment variable is not set")

app = FastAPI()


def require_api_key(x_api_key: str = Header(None)):
    if x_api_key is None or not secrets.compare_digest(x_api_key, API_KEY):
        raise HTTPException(status_code=401, detail="invalid or missing X-API-Key")


EARTH_RADIUS_M = 6371008.8

# Coordinates survive a JSON round-trip exactly, so this only absorbs float noise:
# 1e-6 degrees is about 11 cm.
COORD_TOLERANCE = 1e-6


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in metres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def same_point(entry: dict, latitude: float, longitude: float) -> bool:
    return (
        abs(entry["latitude"] - latitude) <= COORD_TOLERANCE
        and abs(entry["longitude"] - longitude) <= COORD_TOLERANCE
    )


def save_image(upload: UploadFile, contents: bytes) -> str:
    """Write the upload under a generated name and return that name."""
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        suffix = ".jpg"

    name = uuid.uuid4().hex + suffix
    (IMAGES_DIR / name).write_bytes(contents)
    return name


def read_results() -> list:
    if not RESULTS_FILE.exists():
        return []
    with RESULTS_FILE.open() as f:
        return json.load(f)


def write_results(results: list) -> None:
    with RESULTS_FILE.open("w") as f:
        json.dump(results, f, indent=2)


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
):
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    contents = await image.read()
    count = count_parking_spaces(contents)
    filename = save_image(image, contents)

    result = {
        "count": count,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": timestamp,
        # Always present, blank when the caller did not supply them: a photo
        # upload usually cannot know the car park's name, fees or capacity.
        # `total` is null rather than 0 -- 0 would read as "no spaces here" and
        # would divide by zero in any occupancy calculation.
        "name": name,
        "price": price,
        "total": total,
        "source": SOURCE_PHOTO,
        "image": filename,
    }

    results = read_results()
    results.append(result)
    write_results(results)

    return result


@app.get("/results", dependencies=[Depends(require_api_key)])
async def get_results():
    return read_results()


@app.get("/nearby", dependencies=[Depends(require_api_key)])
async def nearby(
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius: float = Query(..., ge=0, description="search radius in metres"),
):
    matches = []
    for entry in read_results():
        d = distance_m(latitude, longitude, entry["latitude"], entry["longitude"])
        if d <= radius:
            matches.append({**entry, "distance_m": round(d, 1)})

    matches.sort(key=lambda e: e["distance_m"])
    return matches


@app.get("/image", dependencies=[Depends(require_api_key)])
async def get_image(
    latitude: float = Query(...),
    longitude: float = Query(...),
):
    matches = [e for e in read_results() if same_point(e, latitude, longitude)]
    if not matches:
        raise HTTPException(status_code=404, detail="no record at this coordinate")

    # Records are stored oldest first, so the last match is the most recent one.
    name = matches[-1].get("image")
    path = IMAGES_DIR / name if name else None
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="record has no stored image")

    return FileResponse(path)


@app.delete("/results", dependencies=[Depends(require_api_key)])
async def delete_result(
    latitude: float = Query(...),
    longitude: float = Query(...),
):
    results = read_results()
    kept = [e for e in results if not same_point(e, latitude, longitude)]
    deleted = len(results) - len(kept)

    if deleted:
        write_results(kept)
        for entry in results:
            if same_point(entry, latitude, longitude) and entry.get("image"):
                (IMAGES_DIR / entry["image"]).unlink(missing_ok=True)

    return {"deleted": deleted, "remaining": len(kept)}
