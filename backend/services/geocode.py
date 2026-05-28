"""
PLZ → GPS-Koordinaten via OpenStreetMap Nominatim
Kostenlos, keine Registrierung erforderlich.
"""
import httpx
import json
import logging
from pathlib import Path
from models.schemas import GeoLocation
from config import settings

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "SturmnachweisToolVersicherungsmakler/1.0"}

# Einfacher On-Disk Cache für PLZ-Lookups (ändert sich selten)
_cache_file = Path(settings.cache_dir) / "geocode_cache.json"


def _load_cache() -> dict:
    if _cache_file.exists():
        try:
            return json.loads(_cache_file.read_text())
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict):
    _cache_file.parent.mkdir(parents=True, exist_ok=True)
    _cache_file.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


async def plz_to_coordinates(plz: str) -> GeoLocation:
    """
    Wandelt eine deutsche PLZ in GPS-Koordinaten + Ortsname um.
    Ergebnis wird gecacht (PLZ ändern sich nicht).
    """
    cache = _load_cache()
    if plz in cache:
        return GeoLocation(**cache[plz])

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            NOMINATIM_URL,
            params={
                "postalcode": plz,
                "country": "DE",
                "format": "jsonv2",
                "limit": 1,
                "addressdetails": 1,
            },
            headers=HEADERS,
            timeout=10.0,
        )
        resp.raise_for_status()
        results = resp.json()

    if not results:
        raise ValueError(f"PLZ {plz} nicht gefunden")

    r = results[0]
    addr = r.get("address", {})

    location = GeoLocation(
        plz=plz,
        ort=addr.get("city") or addr.get("town") or addr.get("village") or plz,
        lat=float(r["lat"]),
        lon=float(r["lon"]),
        bundesland=addr.get("state"),
    )

    cache[plz] = location.model_dump(mode="json")
    _save_cache(cache)

    logger.info(f"PLZ {plz} → {location.ort} ({location.lat:.4f}, {location.lon:.4f})")
    return location
