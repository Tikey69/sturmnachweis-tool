from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    visual_crossing_api_key: str = ""
    knmi_api_key: str = ""
    cache_dir: str = "/app/data/cache"
    log_level: str = "info"
    company_name: str = "Versicherungsmakler"
    company_footer: str = "Erstellt mit Sturmnachweis-Tool"

    # Beaufort-Schwellwerte
    bft8_kmph: float = 62.0   # Untergrenze Bft 8 in km/h (Sturmböe)
    bft8_ms: float = 17.2     # Untergrenze Bft 8 in m/s
    bft9_kmph: float = 75.0

    # DWD Station für westl. Münsterland
    dwd_default_station_id: str = "00617"  # Borken/Westfalen
    dwd_station_name: str = "Borken/Westfalen"

    # Cache TTL in Stunden
    cache_ttl_hours: int = 12

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
