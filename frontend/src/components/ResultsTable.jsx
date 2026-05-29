import { beaufortColor, beaufortLabel } from '../utils/beaufort'

function SourceBadges({ event }) {
  const sources = event.confirming_sources?.length ? event.confirming_sources : [event.source]
  const n = sources.length

  return (
    <div className="flex flex-col gap-1">
      {n >= 2 && (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold
          ${n >= 3 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {n >= 3 ? '✔✔✔' : '✔✔'} {n} Quellen bestätigt
        </span>
      )}
      <div className="flex flex-wrap gap-1">
        {sources.map(src => (
          <span key={src}
            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium
              ${src.includes('DWD') ? 'bg-amber-100 text-amber-800' :
                src.includes('KNMI') ? 'bg-green-100 text-green-800' :
                src.includes('Visual') ? 'bg-purple-100 text-purple-800' :
                'bg-blue-100 text-blue-800'}`}>
            {src}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ResultsTable({ stormDays, damageDate }) {
  const sorted = [...stormDays].sort((a, b) => new Date(b.date) - new Date(a.date))
  const damageDateObj = damageDate ? new Date(damageDate) : null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-base font-semibold text-blue-900">
          Nachgewiesene Sturmtage ({stormDays.length})
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Tage mit maximaler Windböe ≥ 62 km/h (Beaufort 8) — farbige Markierung zeigt Mehrfachbestätigung durch unabhängige Quellen
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-900 text-white">
              <th className="text-left px-4 py-3 font-semibold text-xs">Datum</th>
              <th className="text-right px-4 py-3 font-semibold text-xs">Max. Böe (km/h)</th>
              <th className="text-right px-4 py-3 font-semibold text-xs">Max. Böe (m/s)</th>
              <th className="text-center px-4 py-3 font-semibold text-xs">Beaufort</th>
              <th className="text-right px-4 py-3 font-semibold text-xs">Mittelwind</th>
              <th className="text-left px-4 py-3 font-semibold text-xs">Bestätigende Quellen</th>
              <th className="text-left px-4 py-3 font-semibold text-xs">Station</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((event, i) => {
              const eventDate = new Date(event.date)
              const isDamageDay = damageDateObj &&
                Math.abs(eventDate - damageDateObj) <= 86400000
              const n = event.confirming_sources?.length || 1
              const rowBg = isDamageDay
                ? 'bg-blue-50'
                : n >= 3
                  ? 'bg-green-50'
                  : n === 2
                    ? 'bg-amber-50'
                    : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'

              return (
                <tr key={i} className={`border-b border-gray-100 hover:brightness-95 transition-all ${rowBg}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {eventDate.toLocaleDateString('de-DE')}
                    {isDamageDay && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                        Schadensdatum
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                    {event.max_gust_kmh.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">
                    {event.max_gust_ms.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-1 rounded text-xs font-bold text-white"
                      style={{ backgroundColor: beaufortColor(event.beaufort) }}>
                      Bft {event.beaufort}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">
                    {event.mean_wind_kmh ? `${event.mean_wind_kmh.toFixed(1)} km/h` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <SourceBadges event={event} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {event.station_name || '—'}
                    {event.distance_km > 0 && (
                      <span className="text-gray-400 ml-1">({event.distance_km} km)</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {stormDays.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-400 text-sm">
          Keine Sturmtage ≥ Bft 8 im ausgewählten Zeitraum gefunden.
        </div>
      )}

      {/* Legende */}
      {stormDays.some(e => (e.confirming_sources?.length || 1) >= 2) && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-600">
          <span className="font-semibold">Farbcode Mehrfachbestätigung:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block"></span>
            2 Quellen bestätigt
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300 inline-block"></span>
            3+ Quellen bestätigt (höchste Sicherheit)
          </span>
        </div>
      )}
    </div>
  )
}
