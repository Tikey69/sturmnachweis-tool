"""
KNMI Klimatologie Daggegevens — Niederländischer Wetterdienst
Tertiäre Datenquelle für die Grenzregion Bocholt/Isselburg.

Nutzt den öffentlichen KNMI CDN-Download (kein API-Key erforderlich):
https://cdn.knmi.nl/knmi/map/page/klimatologie/gegevens/daggegevens/etmgeg_{stn}.zip

Primärstation: Winterswijk (278) — ~15 km von Bocholt, ~10 km von Isselburg
Daten ab ca. 1950, täglich aktualisiert.
Lizenz: CC BY 4.0
"""
import io
import math
import logging
import zipfile
from datetime import date, datetime
from pathlib import Path

import httpx

from models.schemas import StormEvent, GeoLocation

logger = logging.getLogger(__name__)

CDN_URL = "https://cdn.knmi.nl/knmi/map/page/klimatologie/gegevens/daggegevens/etmgeg_{stn}.zip"
CACHE_DIR = Path("/data/cache/knmi")

# Grenzstationen sortiert nach Nähe zur Region Bocholt/Isselburg
BORDER_STATIONS = [
    {"stn": 278, "name": "Winterswijk", "lat": 51.970, "lon": 6.657},
    {"stn": 283, "name": "Hupsel",      "lat": 52.069, "lon": 6.657},
    {"stn": 391, "name": "Arcen",       "lat": 51.498, "lon": 6.194},
]

# Max. sinnvoller Abstand: außerhalb Grenzregion liefert KNMI keinen Mehrwert
MAX_DISTANCE_KM = 60.0

BFT_TABLE = [
    (0.0, 0), (1.0, 1), (5.6, 2), (12.0, 3), (20.0, 4),
    (29.0, 5), (39.0, 6), (50.0, 7), (62.0, 8), (75.0, 9),
    (89.0, 10), (103.0, 11), (117.0, 12),
]


def _kmh_to_beaufort(kmh: float) -> int:
    bft = 0
    for threshold, scale in BFT_TABLE:
        if kmh >= threshold:
            bft = scale
        else:
            break
    return bft


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_station(location: GeoLocation) -> dict | None:
    candidates = [
        (s, _distance_km(location.lat, location.lon, s["lat"], s["lon"]))
        for s in BORDER_STATIONS
    ]
    nearest, dist = min(candidates, key=lambda x: x[1])
    if dist > MAX_DISTANCE_KM:
        return None
    return {**nearest, "distance_km": dist}


async def _download_station_data(stn: int) -> bytes:
    """Lädt ZIP-Datei vom KNMI CDN; nutzt 24h-Datei-Cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"etmgeg_{stn}.zip"

    # Cache für 24 Stunden nutzen
    if cache_file.exists():
        age_hours = (datetime.now().timestamp() - cache_file.stat().st_mtime) / 3600
        if age_hours < 24:
            return cache_file.read_bytes()

    url = CDN_URL.format(stn=stn)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    data = resp.content
    cache_file.write_bytes(data)
    logger.info("KNMI: Station %d heruntergeladen (%d KB)", stn, len(data) // 1024)
    return data


def _parse_zip(zip_bytes: bytes, start_date: date, end_date: date, threshold_kmh: float, station: dict) -> list[StormEvent]:
    """Parst KNMI CSV aus ZIP und filtert Sturmtage im Datumsbereich."""
    events: list[StormEvent] = []
    dist = station["distance_km"]

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        filename = z.namelist()[0]
        with z.open(filename) as f:
            for raw_line in f:
                line = raw_line.decode("latin-1").strip()
                if not line or line.startswith("#") or line.startswith("B") or line.startswith("S") or line.startswith("C"):
                    continue

                cols = [c.strip() for c in line.split(",")]
                if len(cols) < 10:
                    continue

                # Spalte 1: YYYYMMDD  |  Spalte 9: FXX (max. Böe in 0.1 m/s)
                try:
                    day_date = date(int(cols[1][:4]), int(cols[1][4:6]), int(cols[1][6:8]))
                except (ValueError, IndexError):
                    continue

                if not (start_date <= day_date <= end_date):
                    continue

                fxx_raw = cols[9]
                if not fxx_raw:
                    continue
                try:
                    fxx_ms = int(fxx_raw) * 0.1
                except ValueError:
                    continue

                gust_kmh = round(fxx_ms * 3.6, 1)
                if gust_kmh < threshold_kmh:
                    continue

                # Spalte 4: FG = Tages-Mittlwindgeschwindigkeit (0.1 m/s)
                mean_kmh = None
                try:
                    fg_raw = cols[4]
                    if fg_raw:
                        mean_kmh = round(int(fg_raw) * 0.1 * 3.6, 1)
                except (ValueError, IndexError):
                    pass

                events.append(StormEvent(
                    date=day_date,
                    max_gust_kmh=gust_kmh,
                    max_gust_ms=round(fxx_ms, 1),
                    beaufort=_kmh_to_beaufort(gust_kmh),
                    mean_wind_kmh=mean_kmh,
                    source="KNMI",
                    station_name=f"{station['name']} (NL, {dist:.0f} km)",
                    distance_km=round(dist, 1),
                    is_confirmed=True,
                ))

    return events


async def get_storm_days(
    location: GeoLocation,
    start_date: date,
    end_date: date,
    threshold_kmh: float = 62.0,
) -> list[StormEvent]:
    """
    Liefert Sturmtage aus der nächstgelegenen KNMI-Grenzstation.
    Kein API-Key erforderlich — nutzt öffentlichen KNMI CDN-Download.
    """
    station = _nearest_station(location)
    if station is None:
        logger.info(
            "KNMI: PLZ %s liegt außerhalb der Grenzregion (> %d km) – überspringe KNMI.",
            location.plz, MAX_DISTANCE_KM,
        )
        return []

    try:
        zip_bytes = await _download_station_data(station["stn"])
    except Exception as e:
        logger.error("KNMI: Download Station %d fehlgeschlagen: %s", station["stn"], e)
        return []

    events = _parse_zip(zip_bytes, start_date, end_date, threshold_kmh, station)

    logger.info(
        "KNMI Station %d (%s, %.0f km): %d Sturmtage im Zeitraum %s–%s.",
        station["stn"], station["name"], station["distance_km"],
        len(events), start_date, end_date,
    )
    return sorted(events, key=lambda e: e.date, reverse=True)
