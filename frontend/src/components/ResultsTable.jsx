import { beaufortColor, beaufortLabel } from '../utils/beaufort'

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
          Tage mit maximaler Windböe ≥ 62 km/h (Beaufort 8)
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
              <th className="text-left px-4 py-3 font-semibold text-xs">Quelle</th>
              <th className="text-left px-4 py-3 font-semibold text-xs">Station</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((event, i) => {
              const eventDate = new Date(event.date)
              const isDamageDay = damageDateObj &&
                Math.abs(eventDate - damageDateObj) <= 86400000
              return (
                <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors
                  ${isDamageDay ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
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
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                      ${event.source.includes('DWD') ? 'bg-amber-100 text-amber-800' :
                        event.source.includes('KNMI') ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'}`}>
                      {event.source}
                    </span>
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
    </div>
  )
}
