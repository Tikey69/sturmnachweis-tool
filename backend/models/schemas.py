from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


class GeoLocation(BaseModel):
    plz: str
    ort: str
    lat: float
    lon: float
    bundesland: Optional[str] = None


class StormEvent(BaseModel):
    date: date
    max_gust_kmh: float
    max_gust_ms: float
    beaufort: int
    mean_wind_kmh: Optional[float] = None
    source: str  # "DWD" | "Open-Meteo" | "KNMI" | "Visual Crossing"
    station_name: Optional[str] = None
    distance_km: Optional[float] = None
    is_confirmed: bool = True  # False = nur Modelldaten
    confirming_sources: List[str] = []  # alle Quellen, die diesen Tag bestätigten


class QueryRequest(BaseModel):
    plz: str = Field(..., min_length=5, max_length=5, pattern=r"^\d{5}$")
    start_date: date
    end_date: date
    threshold_kmh: float = Field(default=62.0, ge=50.0, le=120.0)
    sources: List[str] = Field(
        default=["open_meteo", "dwd", "visual_crossing", "knmi"],
        description="Datenquellen: open_meteo, dwd, knmi, visual_crossing"
    )
    damage_date: Optional[date] = None  # Für PDF-Report


class QueryResponse(BaseModel):
    location: GeoLocation
    storm_days: List[StormEvent]
    last_storm: Optional[StormEvent] = None
    total_storm_days: int
    query_timestamp: datetime
    sources_used: List[str]
    threshold_kmh: float
    period_start: date
    period_end: date


class LastStormResponse(BaseModel):
    location: GeoLocation
    last_storm: Optional[StormEvent] = None
    days_since_last_storm: Optional[int] = None
    search_period_days: int = 365 * 3  # 3 Jahre zurück


class PdfReportRequest(BaseModel):
    plz: str = Field(..., min_length=5, max_length=5, pattern=r"^\d{5}$")
    damage_date: date
    report_date: Optional[date] = None  # Standard: heute
    start_date: Optional[date] = None  # Standard: damage_date - 1 Tag
    end_date: Optional[date] = None    # Standard: damage_date + 1 Tag
    policy_number: Optional[str] = None
    insured_name: Optional[str] = None
    insured_address: Optional[str] = None
    claim_number: Optional[str] = None
    sources: List[str] = Field(default=["open_meteo", "dwd", "visual_crossing", "knmi"])


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    sources_available: List[str]
