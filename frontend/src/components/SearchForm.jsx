import { useState } from 'react'
import { Search, Wind, User } from 'lucide-react'

const today = new Date().toISOString().split('T')[0]
const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]

export default function SearchForm({ onSubmit, loading }) {
  const [plz, setPlz] = useState('')
  const [startDate, setStartDate] = useState(oneYearAgo)
  const [endDate, setEndDate] = useState(today)
  const [damageDate, setDamageDate] = useState(today)
  const [sources, setSources] = useState(['open_meteo', 'dwd', 'visual_crossing', 'knmi'])

  // Kundendaten für PDF
  const [insuredName, setInsuredName] = useState('')
  const [insuredAddress, setInsuredAddress] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [claimNumber, setClaimNumber] = useState('')

  const toggleSource = (src) => {
    setSources(prev =>
      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!plz || plz.length !== 5) return
    onSubmit({
      plz, startDate, endDate, damageDate, sources,
      insuredName, insuredAddress, policyNumber, claimNumber,
    })
  }

  return (
    <form onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">

      {/* Titel */}
      <div className="flex items-center gap-2">
        <Wind className="text-blue-700" size={20} />
        <h2 className="text-lg font-semibold text-blue-900">Sturmabfrage</h2>
      </div>

      {/* Abfrageparameter */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Postleitzahl *
          </label>
          <input
            type="text"
            value={plz}
            onChange={e => setPlz(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="46395"
            maxLength={5}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Schadensdatum *
          </label>
          <input
            type="date"
            value={damageDate}
            onChange={e => setDamageDate(e.target.value)}
            max={today}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Auswertung von
          </label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            max={endDate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Auswertung bis
          </label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            max={today}
            min={startDate}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Datenquellen */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          Datenquellen
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'open_meteo', label: 'Open-Meteo (ERA5)', desc: 'ab 1940, kein API-Key' },
            { id: 'dwd', label: 'DWD Borken', desc: 'offiziell, ab 2004' },
            { id: 'visual_crossing', label: 'Visual Crossing', desc: 'obs, ab 1979' },
            { id: 'knmi', label: 'KNMI (NL)', desc: 'Grenzregion, Winterswijk' },
          ].map(src => (
            <button
              key={src.id}
              type="button"
              onClick={() => toggleSource(src.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                ${sources.includes(src.id)
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
            >
              {src.label}
              <span className="ml-1 opacity-70">{src.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Kundendaten */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="text-gray-400" size={15} />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Kundendaten für PDF-Nachweis (optional)
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Versicherungsnehmer
            </label>
            <input
              type="text"
              value={insuredName}
              onChange={e => setInsuredName(e.target.value)}
              placeholder="Max Mustermann"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Adresse des Versicherungsortes
            </label>
            <input
              type="text"
              value={insuredAddress}
              onChange={e => setInsuredAddress(e.target.value)}
              placeholder="Musterstraße 1, 46395 Bocholt"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Versicherungsnummer / Vertragsnummer
            </label>
            <input
              type="text"
              value={policyNumber}
              onChange={e => setPolicyNumber(e.target.value)}
              placeholder="VS-2024-001234"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Schadensnummer
            </label>
            <input
              type="text"
              value={claimNumber}
              onChange={e => setClaimNumber(e.target.value)}
              placeholder="SCH-2024-005678"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || plz.length !== 5}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400
            text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Search size={16} />
          {loading ? 'Wird abgefragt…' : 'Sturmtage abfragen'}
        </button>
      </div>
    </form>
  )
}
