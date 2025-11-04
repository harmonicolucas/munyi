import math
from functools import lru_cache
from pathlib import Path

from app.config import REPO_ROOT

LAT0 = -25.96
LNG0 = 32.58


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _xy(lat: float, lng: float) -> tuple[float, float]:
    x = (lng - LNG0) * 111.32 * math.cos(math.radians(LAT0))
    y = (lat - LAT0) * 110.574
    return x, y


def point_segment_distance_km(
    lat: float,
    lng: float,
    alat: float,
    alng: float,
    blat: float,
    blng: float,
) -> float:
    px, py = _xy(lat, lng)
    ax, ay = _xy(alat, alng)
    bx, by = _xy(blat, blng)
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    if denom == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


@lru_cache(maxsize=1)
def load_json(name: str) -> dict:
    path = Path(REPO_ROOT / "shared" / name)
    import json

    return json.loads(path.read_text(encoding="utf-8"))
