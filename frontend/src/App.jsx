import { useState } from 'react'
import { FileDown, AlertCircle } from 'lucide-react'
import SearchForm from './components/SearchForm'
import LastStormCard from './components/LastStormCard'
import StormChart from './components/StormChart'
import ResultsTable from './components/ResultsTable'
import NewsCard from './components/NewsCard'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [lastQuery, setLastQuery] = useState(null)

  const handleSearch = async ({
    plz, startDate, endDate, damageDate, sources,
    insuredName, insuredAddress, policyNumber, claimNumber,
  }) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setLastQuery({
      plz, startDate, endDate, damageDate, sources,
      insuredName, insuredAddress, policyNumber, claimNumber,
    })

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
      setResult(await resp.json())
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
          insured_name: lastQuery.insuredName || undefined,
          insured_address: lastQuery.insuredAddress || undefined,
          policy_number: lastQuery.policyNumber || undefined,
          claim_number: lastQuery.claimNumber || undefined,
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
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* ── Header ── */}
      <header style={{
        background: 'rgba(10,20,50,0.65)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '12px',
            padding: '6px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25), 0 1px 3px rgba(255,255,255,0.1) inset',
          }}>
            <img src="/logo.svg" alt="Firmenlogo" style={{ height: 56, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>

          <div className="flex items-center gap-2">
            <span className="header-badge">DWD Borken</span>
            <span className="header-badge">Open-Meteo ERA5</span>
            <span className="header-badge">KNMI</span>
          </div>

          <div style={{ textAlign: 'right', lineHeight: '1.6' }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Sturmnachweis-Tool</p>
            <p style={{ color: '#94a3b8', fontSize: 10 }}>Beaufort-Schwellwert: ≥ Bft 8 (≥ 62 km/h)</p>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-screen-2xl mx-auto px-6 py-7" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <SearchForm onSubmit={handleSearch} loading={loading} />

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 14, padding: '14px 16px',
            color: '#fca5a5',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Fehler bei der Abfrage</p>
              <p style={{ fontSize: 12, opacity: 0.85 }}>{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44,
              border: '3px solid rgba(255,255,255,0.08)',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <p style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600 }}>Wetterdaten werden abgefragt…</p>
            <p style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>DWD · Open-Meteo ERA5 · Geocoding</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'stretch' }}>
              <LastStormCard
                location={result.location}
                lastStorm={result.last_storm}
                damageDate={lastQuery?.damageDate}
                stormDays={result.storm_days}
              />

              {/* Stat card */}
              <div className="glass-card card-pop" style={{ padding: '20px 16px', textAlign: 'center', minWidth: 110 }}>
                <p className="gradient-text" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: -1 }}>
                  {result.total_storm_days}
                </p>
                <p style={{ color: '#94a3b8', fontSize: 10, marginTop: 5, fontWeight: 500 }}>Sturmtage<br />im Zeitraum</p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '10px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {result.sources_used.map(s => (
                    <span key={s} style={{ color: '#93c5fd', fontSize: 10, fontWeight: 600 }}>{s}</span>
                  ))}
                </div>
              </div>

              {/* PDF button */}
              <button onClick={handleDownloadPdf} disabled={pdfLoading} className="btn-pdf">
                <FileDown size={22} />
                <span>{pdfLoading ? 'Erstelle…' : 'PDF-Nachweis'}</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>Download</span>
              </button>
            </div>

            {result.storm_days.length > 0 && (
              <StormChart stormDays={result.storm_days} damageDate={lastQuery?.damageDate} />
            )}

            <ResultsTable stormDays={result.storm_days} damageDate={lastQuery?.damageDate} />

            <NewsCard plz={lastQuery?.plz} damageDate={lastQuery?.damageDate} />

            {/* Footer note */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '12px 16px',
              color: '#475569',
              fontSize: 10,
              lineHeight: 1.7,
            }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Datenquellen-Hinweis: </span>
              Open-Meteo ERA5: Globale Klimareanalyse ECMWF, ab 1940, CC BY 4.0. |
              DWD CDC: Offizielle Messung Station Borken/Westfalen (ID 617), ab 2004. |
              Für verbindliche amtliche Gutachten: DWD Wettergutachten-Service (kostenpflichtig).
            </div>
          </>
        )}
      </main>
    </div>
  )
}
