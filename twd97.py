"""TWD97 TM2 (EPSG:3826) <-> WGS84 conversion, standard library only.

Taipei's open parking data publishes coordinates as TWD97 Transverse Mercator
easting/northing, not latitude/longitude. The forward transform exists only so the
inverse can be round-trip tested.
"""

import math

A = 6378137.0                      # GRS80 semi-major axis
F = 1 / 298.257222101              # GRS80 flattening
E2 = F * (2 - F)                   # first eccentricity squared
LON0 = math.radians(121.0)         # central meridian for the Taiwan main island
K0 = 0.9999                        # scale factor
FALSE_EASTING = 250000.0


def _meridian_arc(lat: float) -> float:
    """Distance along the meridian from the equator to `lat` (radians)."""
    e4, e6 = E2**2, E2**3
    return A * (
        (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * lat
        - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * math.sin(2 * lat)
        + (15 * e4 / 256 + 45 * e6 / 1024) * math.sin(4 * lat)
        - (35 * e6 / 3072) * math.sin(6 * lat)
    )


def to_wgs84(x: float, y: float) -> tuple:
    """TWD97 TM2 easting/northing (metres) -> (latitude, longitude) in degrees."""
    x -= FALSE_EASTING

    e1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
    mu = y / K0 / (A * (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256))

    # Footprint latitude: the latitude whose meridian arc equals y / k0.
    fp = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )

    ep2 = E2 / (1 - E2)
    cos_fp, tan_fp, sin_fp = math.cos(fp), math.tan(fp), math.sin(fp)
    c = ep2 * cos_fp**2
    t = tan_fp**2
    n = A / math.sqrt(1 - E2 * sin_fp**2)
    r = A * (1 - E2) / (1 - E2 * sin_fp**2) ** 1.5
    d = x / (n * K0)

    lat = fp - (n * tan_fp / r) * (
        d**2 / 2
        - (5 + 3 * t + 10 * c - 4 * c**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t + 298 * c + 45 * t**2 - 252 * ep2 - 3 * c**2) * d**6 / 720
    )
    lon = LON0 + (
        d
        - (1 + 2 * t + c) * d**3 / 6
        + (5 - 2 * c + 28 * t - 3 * c**2 + 8 * ep2 + 24 * t**2) * d**5 / 120
    ) / cos_fp

    return math.degrees(lat), math.degrees(lon)


def from_wgs84(lat: float, lon: float) -> tuple:
    """(latitude, longitude) in degrees -> TWD97 TM2 easting/northing. Test aid."""
    lat, lon = math.radians(lat), math.radians(lon)
    ep2 = E2 / (1 - E2)

    n = A / math.sqrt(1 - E2 * math.sin(lat) ** 2)
    t = math.tan(lat) ** 2
    c = ep2 * math.cos(lat) ** 2
    a_ = (lon - LON0) * math.cos(lat)
    m = _meridian_arc(lat)

    x = K0 * n * (
        a_
        + (1 - t + c) * a_**3 / 6
        + (5 - 18 * t + t**2 + 72 * c - 58 * ep2) * a_**5 / 120
    ) + FALSE_EASTING
    y = K0 * (
        m
        + n * math.tan(lat) * (
            a_**2 / 2
            + (5 - t + 9 * c + 4 * c**2) * a_**4 / 24
            + (61 - 58 * t + t**2 + 600 * c - 330 * ep2) * a_**6 / 720
        )
    )
    return x, y
