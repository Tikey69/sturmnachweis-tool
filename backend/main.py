from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from config import settings
from routes import wind, report, news
from models.schemas import HealthResponse

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Sturmnachweis-Tool",
    description="Windstärken-Dokumentation für Versicherungszwecke",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wind.router)
app.include_router(report.router)
app.include_router(news.router)


@app.get("/api/health", response_model=HealthResponse)
async def health():
    from pathlib import Path
    sources = ["Open-Meteo (ERA5)", "DWD CDC"]
    if settings.knmi_api_key:
        sources.append("KNMI")
    if settings.visual_crossing_api_key:
        sources.append("Visual Crossing")
    return HealthResponse(status="ok", sources_available=sources)


@app.get("/api/geocode/{plz}")
async def geocode(plz: str):
    from services.geocode import plz_to_coordinates
    from fastapi import HTTPException
    try:
        loc = await plz_to_coordinates(plz)
        return loc
    except ValueError as e:
        raise HTTPException(404, str(e))
