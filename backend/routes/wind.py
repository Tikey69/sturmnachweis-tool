from fastapi import APIRouter, HTTPException
from datetime import date, timedelta
from models.schemas import QueryRequest, QueryResponse, LastStormResponse
from services import aggregator

router = APIRouter(prefix="/api", tags=["wind"])


@router.post("/query", response_model=QueryResponse)
async def query_wind_data(request: QueryRequest):
    """
    Fragt Sturmtage für eine PLZ und einen Zeitraum ab.
    Kombiniert Daten aus mehreren Quellen (Open-Meteo, DWD, optional KNMI).
    """
    if request.start_date > request.end_date:
        raise HTTPException(400, "start_date muss vor end_date liegen")
    if (request.end_date - request.start_date).days > 365 * 10:
        raise HTTPException(400, "Maximaler Zeitraum: 10 Jahre")

    try:
        result = await aggregator.query_all_sources(
            plz=request.plz,
            start_date=request.start_date,
            end_date=request.end_date,
            threshold_kmh=request.threshold_kmh,
            sources=request.sources,
        )
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Fehler bei der Datenabfrage: {e}")


@router.get("/last-storm/{plz}", response_model=LastStormResponse)
async def get_last_storm(plz: str, years: int = 3):
    """
    Gibt den letzten Sturmtag (Böe ≥ 62 km/h) für eine PLZ zurück.
    Sucht standardmäßig 3 Jahre zurück.
    """
    if not plz.isdigit() or len(plz) != 5:
        raise HTTPException(400, "Ungültige PLZ (5 Stellen, nur Ziffern)")
    if years < 1 or years > 10:
        raise HTTPException(400, "years muss zwischen 1 und 10 liegen")

    try:
        location, last_storm = await aggregator.get_last_storm(plz, lookback_years=years)

        days_since = None
        if last_storm:
            days_since = (date.today() - last_storm.date).days

        return LastStormResponse(
            location=location,
            last_storm=last_storm,
            days_since_last_storm=days_since,
            search_period_days=years * 365,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Fehler: {e}")
