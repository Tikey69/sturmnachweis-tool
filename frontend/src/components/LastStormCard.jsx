import { Cloud, AlertTriangle, CheckCircle } from 'lucide-react'
import { beaufortLabel, beaufortColor } from '../utils/beaufort'

export default function LastStormCard({ location, lastStorm, damageDate, stormDays = [] }) {
  const damageDateObj = damageDate ? new Date(damageDate) : null

  // Prüfen ob am Schadensdatum ein Sturm war
  const isDamageDay = lastStorm && damageDateObj &&
    Math.abs(new Date(lastStorm.date) - damageDateObj) <= 86400000 * 1

  // Sturmtag am Schadensdatum für Mehrquellen-Info
  const damageEvent = damageDateObj
    ? stormDays.find(e => Math.abs(new Date(e.date) - damageDateObj) <= 86400000)
    : null
  const nSources = damageEvent?.confirming_sources?.length || 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Versicherungsort
          </p>
          <h3 className="text-xl font-bold text-blue-900">
            {location.plz} {location.ort}
          </h3>
          {location.bundesland && (
            <p className="text-sm text-gray-500">{location.bundesland}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">GPS</p>
          <p className="text-xs font-mono text-gray-600">
            {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
          </p>
        </div>
      </div>

      {damageDateObj && (
        <div className={`mt-4 rounded-lg p-4 flex items-start gap-3 ${
          isDamageDay ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
        }`}>
          {isDamageDay ? (
            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          ) : (
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Schadensdatum: {damageDateObj.toLocaleDateString('de-DE')}
            </p>
            {isDamageDay ? (
              <div>
                <p className="text-sm text-green-700 mt-0.5">
                  ✔ Windböe ≥ Bft 8 nachgewiesen — Versicherungsvoraussetzung erfüllt
                </p>
                {nSources >= 2 && (
                  <p className={`text-xs font-semibold mt-1.5 px-2 py-1 rounded inline-block
                    ${nSources >= 3
                      ? 'bg-green-200 text-green-900'
                      : 'bg-amber-100 text-amber-900'}`}>
                    {nSources >= 3 ? '✔✔✔' : '✔✔'} Mehrfachbestätigung: {nSources} unabhängige Quellen
                    {damageEvent?.confirming_sources && (
                      <span className="font-normal"> ({damageEvent.confirming_sources.join(' · ')})</span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-amber-700 mt-0.5">
                ⚠ Kein Sturm ≥ Bft 8 direkt am Schadensdatum — Zeitraum prüfen
              </p>
            )}
          </div>
        </div>
      )}

      {lastStorm && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Letzter Sturmtag</p>
            <p className="text-sm font-bold text-gray-800">
              {new Date(lastStorm.date).toLocaleDateString('de-DE')}
            </p>
          </div>
          <div className="rounded-lg p-3" style={{
            backgroundColor: beaufortColor(lastStorm.beaufort) + '22',
            border: `1px solid ${beaufortColor(lastStorm.beaufort)}44`
          }}>
            <p className="text-xs text-gray-500 mb-1">Max. Böe</p>
            <p className="text-sm font-bold" style={{ color: beaufortColor(lastStorm.beaufort) }}>
              {lastStorm.max_gust_kmh.toFixed(1)} km/h
            </p>
          </div>
          <div className="rounded-lg p-3" style={{
            backgroundColor: beaufortColor(lastStorm.beaufort) + '22',
            border: `1px solid ${beaufortColor(lastStorm.beaufort)}44`
          }}>
            <p className="text-xs text-gray-500 mb-1">Beaufort</p>
            <p className="text-sm font-bold" style={{ color: beaufortColor(lastStorm.beaufort) }}>
              Bft {lastStorm.beaufort} — {beaufortLabel(lastStorm.beaufort)}
            </p>
          </div>
        </div>
      )}

      {!lastStorm && (
        <div className="mt-4 flex items-center gap-2 text-gray-500 text-sm">
          <Cloud size={16} />
          <span>Keine Sturmtage ≥ Bft 8 im abgefragten Zeitraum</span>
        </div>
      )}
    </div>
  )
}
