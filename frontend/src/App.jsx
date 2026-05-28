import { useState } from 'react'
import { FileDown, AlertCircle } from 'lucide-react'
import SearchForm from './components/SearchForm'
import LastStormCard from './components/LastStormCard'
import StormChart from './components/StormChart'
import ResultsTable from './components/ResultsTable'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [lastQuery, setLastQuery] = useState(null)

  const handleSearch = async ({ plz, startDate, endDate, damageDate, sources }) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setLastQuery({ plz, startDate, endDate, damageDate, sources })

    try {
      const resp = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plz,
          start_date: startDate,
          end_date: endDate,
          sources,
          damage_date: damageDate,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Unbekannter Fehler')
      }
      const data = await resp.json()
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!lastQuery) return
    setPdfLoading(true)
    try {
      const resp = await fetch('/api/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plz: lastQuery.plz,
          damage_date: lastQuery.damageDate,
          start_date: lastQuery.startDate,
          end_date: lastQuery.endDate,
          sources: lastQuery.sources,
        }),
      })
      if (!resp.ok) throw new Error('PDF-Generierung fehlgeschlagen')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Sturmnachweis_${lastQuery.plz}_${lastQuery.damageDate}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-6">
          <img
            src="/logo.svg"
            alt="Firmenlogo"
            className="h-20 w-auto object-contain"
          />
          <div className="text-right text-xs text-blue-300 shrink-0">
            <p className="text-white font-semibold text-sm mb-1">Sturmnachweis-Tool</p>
            <p>Quellen: DWD · Open-Meteo · KNMI</p>
            <p>Beaufort-Schwellwert: ≥ Bft 8 (≥ 62 km/h)</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Suchformular */}
        <SearchForm onSubmit={handleSearch} loading={loading} />

        {/* Fehleranzeige */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Fehler bei der Abfrage</p>
              <p className="text-sm mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Ladezustand */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Wetterdaten werden abgefragt…</p>
            <p className="text-gray-400 text-xs mt-1">DWD · Open-Meteo ERA5 · Geocoding</p>
          </div>
        )}

        {/* Ergebnisse */}
        {result && !loading && (
          <>
            {/* Zusammenfassung + PDF-Button */}
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <LastStormCard
                  location={result.location}
                  lastStorm={result.last_storm}
                  damageDate={lastQuery?.damageDate}
                />
              </div>

              {/* Statistik-Karten */}
              <div className="flex flex-col gap-3 min-w-[160px]">
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-3xl font-bold text-blue-900">{result.total_storm_days}</p>
                  <p className="text-xs text-gray-500 mt-1">Sturmtage im Zeitraum</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Quellen</p>
                  {result.sources_used.map(s => (
                    <span key={s} className="block text-xs font-medium text-blue-700">{s}</span>
                  ))}
                </div>
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800
                    disabled:bg-gray-400 text-white font-semibold px-4 py-3 rounded-xl text-sm
                    transition-colors shadow-sm"
                >
                  <FileDown size={18} />
                  {pdfLoading ? 'Erstelle PDF…' : 'PDF-Nachweis'}
                </button>
              </div>
            </div>

            {/* Diagramm */}
            {result.storm_days.length > 0 && (
              <StormChart
                stormDays={result.storm_days}
                damageDate={lastQuery?.damageDate}
              />
            )}

            {/* Tabelle */}
            <ResultsTable
              stormDays={result.storm_days}
              damageDate={lastQuery?.damageDate}
            />

            {/* Quellenhinweis */}
            <div className="bg-gray-100 rounded-xl p-4 text-xs text-gray-500">
              <p className="font-semibold mb-1">Datenquellen-Hinweis</p>
              <p>
                Open-Meteo ERA5: Globale Klimareanalyse ECMWF, ab 1940, CC BY 4.0. |
                DWD CDC: Offizielle Messung Station Borken/Westfalen (ID 617), ab 2004. |
                Für verbindliche amtliche Gutachten: DWD Wettergutachten-Service (kostenpflichtig).
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
