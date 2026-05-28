"""
Open-Meteo Historical Weather API
Primäre Datenquelle: ERA5-Reanalyse ab 1940, kein API-Key erforderlich.
Liefert: wind_speed_10m (Mittelwind) + wind_gusts_10m (Spitzenböe) stündlich.
Lizenz: CC BY 4.0
Docs: https://open-meteo.com/en/docs/historical-weather-api
"""
import httpx
import logging
from datetime import date, timedelta
from models.schemas import StormEvent, GeoLocation
from config import settings

logger = logging.getLogger(__name__)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
BFT_TABLE = [
    (0.0, 0), (1.0, 1), (5.6, 2), (12.0, 3), (20.0, 4),
    (29.0, 5), (39.0, 6), (50.0, 7), (62.0, 8), (75.0, 9),
    (89.0, 10), (103.0, 11), (117.0, 12),
]


def kmh_to_beaufort(kmh: float) -> int:
    bft = 0
    for threshold, scale in BFT_TABLE:
        if kmh >= threshold:
            bft = scale
        else:
            break
    return bft


async def get_storm_days(
    location: GeoLocation,
    start_date: date,
    end_date: date,
    threshold_kmh: float = 62.0,
) -> list[StormEvent]:
    """
    Gibt alle Tage zurück, an denen die maximale Windböe >= threshold_kmh war.
    Nutzt Open-Meteo ERA5-Reanalyse (stündliche Daten).
    """
    # Open-Meteo unterstützt max. ~1 Jahr pro Anfrage bei hoher Auflösung;
    # bei langen Zeiträumen aufteilen
    all_events = []

    chunk_start = start_date
    while chunk_start <= end_date:
        chunk_end = min(chunk_start + timedelta(days=364), end_date)
        events = await _fetch_chunk(location, chunk_start, chunk_end, threshold_kmh)
        all_events.extend(events)
        chunk_start = chunk_end + timedelta(days=1)

    return sorted(all_events, key=lambda e: e.date, reverse=True)


async def _fetch_chunk(
    location: GeoLocation,
    start: date,
    end: date,
    threshold_kmh: float,
) -> list[StormEvent]:
    params = {
        "latitude": round(location.lat, 4),
        "longitude": round(location.lon, 4),
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "hourly": "wind_speed_10m,wind_gusts_10m",
        "wind_speed_unit": "kmh",
        "timezone": "Europe/Berlin",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(ARCHIVE_URL, params=params, timeout=30.0)
        resp.raise_for_status()
        data = resp.json()

    times = data["hourly"]["time"]
    speeds = data["hourly"]["wind_speed_10m"]
    gusts = data["hourly"]["wind_gusts_10m"]

    # Tagweise aggregieren: max Böe + max Mittelwind pro Tag
    daily: dict[str, dict] = {}
    for t, spd, gust in zip(times, speeds, gusts):
        if spd is None and gust is None:
            continue
        day = t[:10]  # "YYYY-MM-DD"
        if day not in daily:
            daily[day] = {"max_gust": 0.0, "max_speed": 0.0}
        if gust is not None:
            daily[day]["max_gust"] = max(daily[day]["max_gust"], gust)
        if spd is not None:
            daily[day]["max_speed"] = max(daily[day]["max_speed"], spd)

    events = []
    for day_str, vals in daily.items():
        if vals["max_gust"] >= threshold_kmh:
            events.append(StormEvent(
                date=date.fromisoformat(day_str),
                max_gust_kmh=round(vals["max_gust"], 1),
                max_gust_ms=round(vals["max_gust"] / 3.6, 1),
                beaufort=kmh_to_beaufort(vals["max_gust"]),
                mean_wind_kmh=round(vals["max_speed"], 1),
                source="Open-Meteo (ERA5)",
                station_name="ERA5-Reanalyse",
                distance_km=0.0,  # Modell interpoliert auf GPS-Punkt
                is_confirmed=True,
            ))

    logger.info(
        f"Open-Meteo: {len(events)} Sturmtage für {location.ort} "
        f"({start}–{end}, ≥{threshold_kmh} km/h)"
    )
    return events
