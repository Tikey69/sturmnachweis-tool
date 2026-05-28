"""
Aggregiert Sturmtage aus mehreren Datenquellen.
Priorisierungslogik: DWD > Open-Meteo > KNMI > Visual Crossing
Für denselben Tag wird die Quelle mit der höchsten Böe verwendet.
"""
import logging
from datetime import date, datetime, timedelta
from models.schemas import StormEvent, GeoLocation, QueryResponse
from services import geocode, open_meteo, dwd, knmi, visual_crossing
from config import settings

logger = logging.getLogger(__name__)


async def query_all_sources(
    plz: str,
    start_date: date,
    end_date: date,
    threshold_kmh: float = 62.0,
    sources: list[str] | None = None,
) -> QueryResponse:
    """
    Hauptfunktion: Fragt alle konfigurierten Quellen ab und merged die Ergebnisse.
    """
    if sources is None:
        sources = ["open_meteo", "dwd", "visual_crossing", "knmi"]

    location = await geocode.plz_to_coordinates(plz)
    all_events: list[StormEvent] = []
    sources_used: list[str] = []

    # Quellen nacheinander abfragen
    if "open_meteo" in sources:
        try:
            events = await open_meteo.get_storm_days(
                location, start_date, end_date, threshold_kmh
            )
            all_events.extend(events)
            if events:
                sources_used.append("Open-Meteo (ERA5)")
        except Exception as e:
            logger.error(f"Open-Meteo Fehler: {e}")

    if "dwd" in sources:
        try:
            events = await dwd.get_storm_days(
                location, start_date, end_date, threshold_kmh
            )
            all_events.extend(events)
            if events:
                sources_used.append("DWD")
        except Exception as e:
            logger.error(f"DWD Fehler: {e}")

    if "knmi" in sources:
        try:
            events = await knmi.get_storm_days(
                location, start_date, end_date, threshold_kmh
            )
            all_events.extend(events)
            if events:
                sources_used.append("KNMI")
        except Exception as e:
            logger.error(f"KNMI Fehler: {e}")

    if "visual_crossing" in sources:
        try:
            events = await visual_crossing.get_storm_days(
                location, start_date, end_date, threshold_kmh
            )
            all_events.extend(events)
            if events:
                sources_used.append("Visual Crossing")
        except Exception as e:
            logger.error(f"Visual Crossing Fehler: {e}")

    # Merge: Pro Tag das Maximum aus allen Quellen nehmen
    merged = _merge_by_date(all_events)
    last_storm = merged[0] if merged else None

    return QueryResponse(
        location=location,
        storm_days=merged,
        last_storm=last_storm,
        total_storm_days=len(merged),
        query_timestamp=datetime.now(),
        sources_used=sources_used if sources_used else ["Keine Daten verfügbar"],
        threshold_kmh=threshold_kmh,
        period_start=start_date,
        period_end=end_date,
    )


def _merge_by_date(events: list[StormEvent]) -> list[StormEvent]:
    """
    Für jeden Tag: behält den Eintrag mit der höchsten Böe.
    Sortiert absteigend nach Datum.
    """
    by_date: dict[date, StormEvent] = {}
    for event in events:
        if event.date not in by_date:
            by_date[event.date] = event
        elif event.max_gust_kmh > by_date[event.date].max_gust_kmh:
            by_date[event.date] = event

    return sorted(by_date.values(), key=lambda e: e.date, reverse=True)


async def get_last_storm(
    plz: str,
    threshold_kmh: float = 62.0,
    lookback_years: int = 3,
) -> tuple[GeoLocation, StormEvent | None]:
    """
    Sucht den letzten Sturmtag innerhalb der letzten lookback_years Jahre.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=365 * lookback_years)

    result = await query_all_sources(
        plz, start_date, end_date, threshold_kmh,
        sources=["open_meteo", "dwd"]
    )

    return result.location, result.last_storm
