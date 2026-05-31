import { useState } from 'react'
import { Search, Wind, User } from 'lucide-react'

const today = new Date().toISOString().split('T')[0]
const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]

const SOURCES = [
  { id: 'open_meteo',      label: 'Open-Meteo (ERA5)', desc: 'ab 1940' },
  { id: 'dwd',             label: 'DWD Borken',        desc: 'offiziell' },
  { id: 'knmi',            label: 'KNMI (NL)',          desc: 'Grenzregion' },
  { id: 'visual_crossing', label: 'Visual Crossing',   desc: 'Fallback' },
]

export default function SearchForm({ onSubmit, loading }) {
  const [plz, setPlz] = useState('')
  const [startDate, setStartDate] = useState(oneYearAgo)
  const [endDate, setEndDate] = useState(today)
  const [damageDate, setDamageDate] = useState(today)
  const [sources, setSources] = useState(['open_meteo', 'dwd', 'visual_crossing', 'knmi'])

  const [insuredName, setInsuredName] = useState('')
  const [insuredAddress, setInsuredAddress] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [claimNumber, setClaimNumber] = useState('')

  const toggleSource = (src) =>
    setSources(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!plz || plz.length !== 5) return
    onSubmit({ plz, startDate, endDate, damageDate, sources, insuredName, insuredAddress, policyNumber, claimNumber })
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card" style={{ padding: 26 }}>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 34, height: 34,
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
          flexShrink: 0,
        }}>
          <Wind size={17} color="white" />
        </div>
        <div>
          <h2 style={{ color: 'white', fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>Sturmabfrage</h2>
          <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 1 }}>PLZ, Zeitraum und Schadensdatum eingeben</p>
        </div>
      </div>

      {/* Main fields */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div>
          <label className="field-label">Postleitzahl *</label>
          <input
            className="glass-input"
            type="text"
            value={plz}
            onChange={e => setPlz(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="46395"
            maxLength={5}
            required
            style={{ fontFamily: 'monospace', fontWeight: 700 }}
          />
        </div>
        <div>
          <label className="field-label">Schadensdatum *</label>
          <input
            className="glass-input"
            type="date"
            value={damageDate}
            onChange={e => setDamageDate(e.target.value)}
            max={today}
            required
          />
        </div>
        <div>
          <label className="field-label">Auswertung von</label>
          <input
            className="glass-input"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            max={endDate}
          />
        </div>
        <div>
          <label className="field-label">Auswertung bis</label>
          <input
            className="glass-input"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            max={today}
            min={startDate}
          />
        </div>
      </div>

      {/* Data sources */}
      <div style={{ marginBottom: 18 }}>
        <label className="field-label" style={{ marginBottom: 8 }}>Datenquellen</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SOURCES.map(src => (
            <button
              key={src.id}
              type="button"
              onClick={() => toggleSource(src.id)}
              className={`source-chip ${sources.includes(src.id) ? 'source-chip-on' : 'source-chip-off'}`}
            >
              {src.label}
              <span style={{ marginLeft: 4, opacity: 0.6, fontWeight: 400 }}>· {src.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0 16px' }} />

      {/* Customer data */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <User size={13} color="#475569" />
          <span style={{ color: '#475569', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Kundendaten für PDF-Nachweis
          </span>
          <span style={{ color: '#334155', fontSize: 10 }}>(optional)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="field-label">Versicherungsnehmer</label>
            <input className="glass-input" type="text" value={insuredName}
              onChange={e => setInsuredName(e.target.value)} placeholder="Max Mustermann" />
          </div>
          <div>
            <label className="field-label">Adresse des Versicherungsortes</label>
            <input className="glass-input" type="text" value={insuredAddress}
              onChange={e => setInsuredAddress(e.target.value)} placeholder="Musterstraße 1, 46395 Bocholt" />
          </div>
          <div>
            <label className="field-label">Versicherungsnummer / Vertragsnummer</label>
            <input className="glass-input" type="text" value={policyNumber}
              onChange={e => setPolicyNumber(e.target.value)} placeholder="VS-2024-001234" />
          </div>
          <div>
            <label className="field-label">Schadensnummer</label>
            <input className="glass-input" type="text" value={claimNumber}
              onChange={e => setClaimNumber(e.target.value)} placeholder="SCH-2024-005678" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading || plz.length !== 5} className="btn-primary">
          <Search size={15} />
          {loading ? 'Wird abgefragt…' : 'Sturmtage abfragen'}
        </button>
      </div>
    </form>
  )
}
