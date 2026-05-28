"""
Visual Crossing Weather API
Historische Wetterdaten mit echten Beobachtungsdaten (source: obs).
Nutzt regionale Stationen inkl. DWD Borken (00617) und EDLV.
Docs: https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/
"""
import httpx
import logging
from datetime import date, timedelta
from models.schemas import StormEvent, GeoLocation
from config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline"

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
    Gibt alle Sturmtage zurück, an denen windgust >= threshold_kmh war.
    Visual Crossing liefert echte Beobachtungsdaten (obs) von regionalen Stationen.
    """
    if not settings.visual_crossing_api_key:
        logger.info("Visual Crossing API-Key nicht konfiguriert – überspringe Quelle.")
        return []

    all_events: list[StormEvent] = []
    chunk_start = start_date
    while chunk_start <= end_date:
        chunk_end = min(chunk_start + timedelta(days=364), end_date)
        try:
            events = await _fetch_chunk(location, chunk_start, chunk_end, threshold_kmh)
            all_events.extend(events)
        except Exception as e:
            logger.error(f"Visual Crossing Fehler ({chunk_start}–{chunk_end}): {e}")
        chunk_start = chunk_end + timedelta(days=1)

    return sorted(all_events, key=lambda e: e.date, reverse=True)


async def _fetch_chunk(
    location: GeoLocation,
    start: date,
    end: date,
    threshold_kmh: float,
) -> list[StormEvent]:
    url = (
        f"{BASE_URL}/{location.lat},{location.lon}"
        f"/{start.isoformat()}/{end.isoformat()}"
    )
    params = {
        "unitGroup": "metric",
        "key": settings.visual_crossing_api_key,
        "contentType": "json",
        "include": "days",
        "elements": "datetime,windgust,windspeed,winddir",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    events: list[StormEvent] = []
    stations = data.get("stations", {})
    station_names = ", ".join(
        s.get("name", sid) for sid, s in stations.items()
    ) if isinstance(stations, dict) else "Visual Crossing"

    for day in data.get("days", []):
        gust_kmh = day.get("windgust") or 0.0
        if gust_kmh < threshold_kmh:
            continue

        wind_kmh = day.get("windspeed") or 0.0
        gust_ms = round(gust_kmh / 3.6, 1)
        bft = kmh_to_beaufort(gust_kmh)
        day_date = date.fromisoformat(day["datetime"])

        events.append(StormEvent(
            date=day_date,
            max_gust_kmh=round(gust_kmh, 1),
            max_gust_ms=gust_ms,
            beaufort=bft,
            mean_wind_kmh=round(wind_kmh, 1),
            source="Visual Crossing (obs)",
            station_name=station_names or "Regional",
        ))

    logger.info(
        f"Visual Crossing: {len(events)} Sturmtage von {len(data.get('days', []))} Tagen "
        f"({start}–{end})"
    )
    return events
