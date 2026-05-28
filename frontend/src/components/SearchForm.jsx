import { useState } from 'react'
import { Search, Wind } from 'lucide-react'

const today = new Date().toISOString().split('T')[0]
const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]

export default function SearchForm({ onSubmit, loading }) {
  const [plz, setPlz] = useState('')
  const [startDate, setStartDate] = useState(oneYearAgo)
  const [endDate, setEndDate] = useState(today)
  const [damageDate, setDamageDate] = useState(today)
  const [sources, setSources] = useState(['open_meteo', 'dwd', 'visual_crossing', 'knmi'])

  const toggleSource = (src) => {
    setSources(prev =>
      prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!plz || plz.length !== 5) return
    onSubmit({ plz, startDate, endDate, damageDate, sources })
  }

  return (
    <form onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

      <div className="flex items-center gap-2 mb-5">
        <Wind className="text-blue-700" size={20} />
        <h2 className="text-lg font-semibold text-blue-900">Sturmabfrage</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* PLZ */}
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

        {/* Schadensdatum */}
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

        {/* Zeitraum Von */}
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

        {/* Zeitraum Bis */}
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

      {/* Quellen */}
      <div className="mt-4">
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

      <div className="mt-5 flex justify-end">
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
