"""Parking space counting delegated to a remote parking-count-api instance.

The vision model itself runs on someone else's machine (their Ollama + qwen3-vl),
exposed as their own copy of this same API. We reuse their /upload endpoint purely
to get a count back; latitude/longitude sent to them are dummy values because only
their `count` field is used -- whatever record they persist on their own side is
irrelevant here. When the model moves somewhere we control (e.g. the cloud), this
is the only function that needs to change.
"""

import os

import httpx

REMOTE_MODEL_URL = os.environ.get("REMOTE_MODEL_URL")
REMOTE_MODEL_API_KEY = os.environ.get("REMOTE_MODEL_API_KEY")

if not REMOTE_MODEL_URL or not REMOTE_MODEL_API_KEY:
    raise RuntimeError(
        "REMOTE_MODEL_URL / REMOTE_MODEL_API_KEY environment variables are not set"
    )


def count_parking_spaces(image: bytes) -> int:
    """Return the number of empty parking spaces visible in the image."""
    response = httpx.post(
        f"{REMOTE_MODEL_URL.rstrip('/')}/upload",
        headers={"X-API-Key": REMOTE_MODEL_API_KEY},
        files={"image": ("upload.jpg", image, "image/jpeg")},
        data={"latitude": "0", "longitude": "0"},
        timeout=120,
    )
    response.raise_for_status()
    return response.json()["count"]
