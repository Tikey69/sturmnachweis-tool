# 🌪 Sturmnachweis-Tool

**Windstärken-Dokumentation für Versicherungsmakler**

Automatisierter Nachweis von Windstärke ≥ 8 Beaufort (≥ 62 km/h Böen)
für Sturmschadensmeldungen. Kombination aus offiziellen Wetterdaten (DWD),
globaler ERA5-Reanalyse (Open-Meteo) und niederländischen Grenzstationen (KNMI).

---

## Schnellstart (Docker)

```bash
# 1. Repository klonen oder entpacken
cd sturmnachweis-tool

# 2. Konfiguration
cp .env.example .env
# Optional: API-Keys in .env eintragen

# 3. Starten
docker compose up --build -d

# 4. Browser öffnen
open http://localhost
```

## Features

- 🔍 **PLZ-Suche** → Letzter Sturmtag + Sturmtage-Übersicht
- 📊 **Interaktives Diagramm** mit Beaufort-Farbkodierung
- 📄 **PDF-Nachweis** im professionellen Versicherungsformat
- 🗺 **Mehrere Datenquellen** automatisch kombiniert
- 🏭 **Docker-fähig** für Firmen-internen Einsatz

## Datenquellen

| Quelle | Zeitraum | Böen | API-Key |
|--------|----------|------|---------|
| Open-Meteo ERA5 | ab 1940 | ✓ | Nicht nötig |
| DWD Borken (617) | ab 2004 | ✓ (FX 10min) | Nicht nötig |
| KNMI (NL) | ab ~2000 | ✓ | Kostenlos |
| Visual Crossing | 50 Jahre | ✓ | Kostenlos |

## API-Dokumentation

Nach Start verfügbar unter: **http://localhost/api/docs**

### Wichtige Endpunkte

```
GET  /api/last-storm/{PLZ}           → Letzter Sturmtag
POST /api/query                      → Sturmtage im Zeitraum
POST /api/report/pdf                 → PDF-Nachweis generieren
```

## Konfiguration (.env)

```env
VISUAL_CROSSING_API_KEY=   # optional
KNMI_API_KEY=              # optional, für NL-Grenzstationen
EXPOSE_PORT=80             # Port für nginx
COMPANY_NAME=Mein Maklerbüro
COMPANY_FOOTER=Erstellt mit Sturmnachweis-Tool
```

## Entwicklung (ohne Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # → http://localhost:5173
```

## Beaufort-Skala (Versicherungsrelevanz)

| Bft | km/h | Bezeichnung | Versicherung |
|-----|------|-------------|--------------|
| 7 | 50–61 | Steifer Wind | Manchmal (je nach Tarif) |
| **8** | **62–74** | **Stürmischer Wind** | **Standard-Grenze** |
| 9 | 75–88 | Sturm | ✓ |
| 10+ | 89+ | Schwerer Sturm/Orkan | ✓ |

---

Für amtliche Gutachten: [DWD Wettergutachten](https://www.dwd.de/wettergutachten)
