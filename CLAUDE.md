# Sturmnachweis-Tool — Claude Code Anleitung

## Projektübersicht

Dieses Tool ist für einen Versicherungsmakler im westlichen Münsterland entwickelt.
Es ermöglicht den Nachweis von Windstärke ≥ 8 Beaufort (≥ 62 km/h Böen) an einem
Versicherungsort für Sturmschadensmeldungen.

## Stack

- **Backend**: Python 3.11, FastAPI, uvicorn
- **Frontend**: React 18, Vite, Recharts, Tailwind CSS
- **PDF**: ReportLab + Matplotlib (serverseitig)
- **Datenquellen**: Open-Meteo (primär), DWD CDC (sekundär), KNMI (Grenzregion)
- **Deployment**: Docker Compose (nginx + backend + frontend)

## Sofort lauffähig machen

```bash
cp .env.example .env
# Optional: VISUAL_CROSSING_API_KEY in .env eintragen
docker compose up --build
# → http://localhost aufrufen
```

## Was bereits vollständig implementiert ist

- [x] Projektstruktur und Docker-Setup
- [x] FastAPI Backend mit allen Routes
- [x] Open-Meteo Service (primäre Datenquelle, kein API-Key nötig)
- [x] DWD CDC Service (Station 617 Borken + Stationssuche)
- [x] KNMI Service (Niederländische Grenzstationen)
- [x] PLZ → GPS Geocoding (Nominatim/OSM)
- [x] Beaufort-Konvertierung und Storm-Day-Logik
- [x] PDF-Generator (ReportLab + Matplotlib)
- [x] React Frontend mit Suchformular
- [x] Sturmtage-Diagramm (Recharts BarChart)
- [x] Ergebnistabelle mit Quellangabe
- [x] nginx Reverse Proxy

## Was noch zu erledigen ist / Erweiterungen

### Priorität 1 (für Produktionseinsatz)
- [ ] DWD ZIP-Parsing für historische Daten (> 500 Tage) testen
  - Datei: `backend/services/dwd.py` → Funktion `get_historical_data()`
  - Die DWD ZIP-Dateien haben das Format: `10minutenwerte_wind_HHHHH_JJJJMMTT_JJJJMMTT_hist.zip`
  - Station 617: Prüfen ob Windmessung tatsächlich vorhanden (nebenamtliche Station)
- [ ] KNMI API-Key registrieren unter `dataplatform.knmi.nl`
  - In `.env` als `KNMI_API_KEY` eintragen
  - Datei: `backend/services/knmi.py` → Bearer Token Authentication
- [ ] Cache-Datenbank: SQLite statt JSON-File-Cache für Produktionsbetrieb
- [ ] Nutzer-Authentifizierung (optional, da internes Firmentool)

### Priorität 2 (Nice-to-have)
- [ ] Karten-Overlay mit Stationsstandorten (Leaflet.js)
- [ ] CSV-Export der Sturmtage
- [ ] E-Mail-Versand des PDF-Reports
- [ ] Mehrsprachigkeit (DE/NL für Grenzregion)

## Wichtige Konstanten (Beaufort-Skala)

```python
BFT_8_KMPH = 62.0   # Untergrenze Bft 8 in km/h
BFT_8_MS   = 17.2   # Untergrenze Bft 8 in m/s
BFT_9_KMPH = 75.0   # Untergrenze Bft 9 in km/h
```

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/api/health` | Health-Check |
| GET | `/api/geocode/{plz}` | PLZ → Koordinaten + Ortsname |
| POST | `/api/query` | Sturmtage abfragen |
| GET | `/api/last-storm/{plz}` | Letzter Sturmtag für PLZ |
| POST | `/api/report/pdf` | PDF-Report generieren |

## Datenquellen-Priorität

1. **DWD Station 617 (Borken)** – offizielle Messdaten, stärkste Rechtswirkung
2. **Open-Meteo ERA5** – Reanalysedaten ab 1940, kein API-Key, global
3. **KNMI** – Dutch Meteorological Institute, relevant für Isselburg/Bocholt-West
4. **Visual Crossing** – Fallback, 50 Jahre historisch (API-Key erforderlich)

## Dateistruktur

```
sturmnachweis-tool/
├── CLAUDE.md               ← diese Datei
├── README.md
├── docker-compose.yml
├── .env.example
├── data/cache/             ← API-Cache (wird automatisch befüllt)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py             ← FastAPI App Entry Point
│   ├── config.py           ← Konfiguration aus .env
│   ├── models/schemas.py   ← Pydantic Request/Response Models
│   ├── services/
│   │   ├── geocode.py      ← PLZ → GPS (Nominatim)
│   │   ├── open_meteo.py   ← Open-Meteo Historical API (primär)
│   │   ├── dwd.py          ← DWD CDC OpenData (sekundär)
│   │   ├── knmi.py         ← KNMI Data Platform (tertiär)
│   │   ├── aggregator.py   ← Quellen zusammenführen
│   │   └── pdf_generator.py← ReportLab PDF + Matplotlib Chart
│   └── routes/
│       ├── wind.py         ← /api/query, /api/last-storm
│       └── report.py       ← /api/report/pdf
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── SearchForm.jsx
        │   ├── StormChart.jsx
        │   ├── ResultsTable.jsx
        │   └── LastStormCard.jsx
        └── utils/beaufort.js
```
