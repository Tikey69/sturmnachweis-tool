"""
DWD CDC Open Data Service
Sekundäre Datenquelle: Offizielle Messdaten (Station 617 Borken/Westfalen).
Daten: 10-Minuten-Windmessungen inkl. FX (Spitzenböe), ab 2004.
Lizenz: DWD Open Data (unentgeltlich)
Docs: https://opendata.dwd.de/climate_environment/CDC/
"""
import httpx
import zipfile
import io
import csv
import logging
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from models.schemas import StormEvent, GeoLocation
from config import settings

logger = logging.getLogger(__name__)

DWD_BASE = "https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate"
STATION_ID = settings.dwd_default_station_id  # "00617" = Borken
STATION_COORDS = (51.848, 6.866)  # Borken, ~2 km NÖ von Gemen
STATION_NAME = "Borken/Westfalen (DWD 617)"
DATA_SINCE = date(2004, 6, 1)  # Station aktiv seit 01.06.2004

BFT_TABLE = [
    (0.0, 0), (1.0, 1), (5.6, 2), (12.0, 3), (20.0, 4),
    (29.0, 5), (39.0, 6), (50.0, 7), (62.0, 8), (75.0, 9),
    (89.0, 10), (103.0, 11), (117.0, 12),
]


def _ms_to_beaufort(ms: float) -> int:
    kmh = ms * 3.6
    bft = 0
    for threshold, scale in BFT_TABLE:
        if kmh >= threshold:
            bft = scale
        else:
            break
    return bft


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * \
        math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _station_distance(location: GeoLocation) -> float:
    return _haversine_km(
        location.lat, location.lon,
        STATION_COORDS[0], STATION_COORDS[1]
    )


async def _download_and_parse_zip(url: str) -> list[dict]:
    """
    Lädt eine DWD ZIP-Datei herunter und parst die enthaltene CSV.
    Gibt Liste von Dicts mit MESS_DATUM, FX_10 (Böe m/s), FF_10 (Mittel m/s) zurück.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=60.0, follow_redirects=True)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()

    rows = []
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        # CSV-Datei im ZIP finden (beginnt mit "produkt_")
        csv_name = next(
            (n for n in zf.namelist() if n.startswith("produkt_")),
            None
        )
        if not csv_name:
            logger.warning(f"Keine Produktdatei in {url}")
            return []

        with zf.open(csv_name) as f:
            reader = csv.DictReader(
                io.TextIOWrapper(f, encoding="latin-1"),
                delimiter=";"
            )
            for row in reader:
                rows.append({k.strip(): v.strip() for k, v in row.items()})

    return rows


async def get_storm_days(
    location: GeoLocation,
    start_date: date,
    end_date: date,
    threshold_kmh: float = 62.0,
) -> list[StormEvent]:
    """
    Liest Sturmtage aus DWD Station 617 (Borken).
    Nutzt aktuelle (recent) und ggf. historische Daten.
    """
    if end_date < DATA_SINCE:
        logger.info("DWD: Zeitraum vor Stationseröffnung (2004), übersprungen.")
        return []

    threshold_ms = threshold_kmh / 3.6
    distance = _station_distance(location)

    # URL für aktuelle Daten (letzte ~500 Tage)
    recent_url = (
        f"{DWD_BASE}/10_minutes/wind/recent/"
        f"10minutenwerte_wind_{STATION_ID}_akt.zip"
    )

    rows = await _download_and_parse_zip(recent_url)

    if not rows:
        logger.warning("DWD: Keine Daten aus Recent-Archiv erhalten.")
        return []

    # Tagweise aggregieren
    daily: dict[str, dict] = {}
    for row in rows:
        mess = row.get("MESS_DATUM", "")
        if len(mess) < 12:
            continue
        try:
            dt = datetime.strptime(mess, "%Y%m%d%H%M")
        except ValueError:
            continue

        day = dt.date()
        if day < start_date or day > end_date:
            continue

        try:
            fx = float(row.get("FX_10", "").replace(",", "."))  # Spitzenböe
            ff = float(row.get("FF_10", "").replace(",", "."))  # Mittelwind
        except (ValueError, TypeError):
            continue

        if fx < 0 or ff < 0:  # -999 = fehlender Wert
            continue

        day_str = day.isoformat()
        if day_str not in daily:
            daily[day_str] = {"max_gust_ms": 0.0, "max_speed_ms": 0.0}
        daily[day_str]["max_gust_ms"] = max(daily[day_str]["max_gust_ms"], fx)
        daily[day_str]["max_speed_ms"] = max(daily[day_str]["max_speed_ms"], ff)

    events = []
    for day_str, vals in daily.items():
        if vals["max_gust_ms"] >= threshold_ms:
            gust_kmh = vals["max_gust_ms"] * 3.6
            events.append(StormEvent(
                date=date.fromisoformat(day_str),
                max_gust_kmh=round(gust_kmh, 1),
                max_gust_ms=round(vals["max_gust_ms"], 1),
                beaufort=_ms_to_beaufort(vals["max_gust_ms"]),
                mean_wind_kmh=round(vals["max_speed_ms"] * 3.6, 1),
                source="DWD",
                station_name=STATION_NAME,
                distance_km=round(distance, 1),
                is_confirmed=True,
            ))

    logger.info(
        f"DWD: {len(events)} Sturmtage gefunden "
        f"(Station {STATION_ID}, {distance:.1f} km Entfernung)"
    )
    return sorted(events, key=lambda e: e.date, reverse=True)
