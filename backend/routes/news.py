from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from datetime import date
from services import news_scraper
from services.geocode import plz_to_coordinates

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/{plz}")
async def get_storm_news(
    plz: str,
    damage_date: date = Query(..., description="Schadensdatum (YYYY-MM-DD)"),
):
    """
    Sucht bei BBV-Net nach Sturmmeldungen zum Schadensdatum.
    Gibt Artikel-Metadaten zurück; Screenshot separat über /screenshot abrufbar.
    """
    try:
        loc = await plz_to_coordinates(plz)
    except ValueError as e:
        raise HTTPException(404, str(e))

    result = await news_scraper.search_storm_news(
        damage_date=damage_date,
        location_name=loc.ort,
    )

    return {
        "articles": result["articles"],
        "search_url": result["search_url"],
        "found": result["found"],
        "has_screenshot": result["screenshot"] is not None,
        "query": result.get("query", ""),
    }


@router.get("/{plz}/screenshot")
async def get_news_screenshot(
    plz: str,
    damage_date: date = Query(..., description="Schadensdatum (YYYY-MM-DD)"),
):
    """Gibt den Screenshot der BBV-Net-Suchergebnisseite als PNG zurück."""
    try:
        loc = await plz_to_coordinates(plz)
    except ValueError as e:
        raise HTTPException(404, str(e))

    result = await news_scraper.search_storm_news(
        damage_date=damage_date,
        location_name=loc.ort,
    )

    if not result["screenshot"]:
        raise HTTPException(404, "Kein Screenshot verfügbar")

    return Response(
        content=result["screenshot"],
        media_type="image/png",
        headers={"Cache-Control": "max-age=86400"},
    )
