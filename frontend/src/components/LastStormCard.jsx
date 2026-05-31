import { Cloud, AlertTriangle, CheckCircle } from 'lucide-react'
import { beaufortLabel, beaufortColor } from '../utils/beaufort'

export default function LastStormCard({ location, lastStorm, damageDate, stormDays = [] }) {
  const damageDateObj = damageDate ? new Date(damageDate) : null

  const damageEvent = damageDateObj
    ? stormDays
        .filter(e => Math.abs(new Date(e.date) - damageDateObj) <= 86400000)
        .sort((a, b) => {
          const diffA = Math.abs(new Date(a.date) - damageDateObj)
          const diffB = Math.abs(new Date(b.date) - damageDateObj)
          if (diffA !== diffB) return diffA - diffB      // kürzester Abstand zuerst
          return b.max_gust_kmh - a.max_gust_kmh         // bei Gleichstand: höchste Böe
        })[0] ?? null
    : null
  const isDamageDay = !!damageEvent
  const nSources = damageEvent?.confirming_sources?.length || 0

  return (
    <div className="glass-card card-3d" style={{ padding: 22 }}>
      {/* Location header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <p style={{ color: '#94a3b8', fontSize: 9, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
            Versicherungsort
          </p>
          <h3 style={{ color: 'white', fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>
            {location.plz} {location.ort}
          </h3>
          {location.bundesland && (
            <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{location.bundesland}</p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#94a3b8', fontSize: 9, marginBottom: 2 }}>GPS</p>
          <p style={{ color: '#cbd5e1', fontSize: 10, fontFamily: 'monospace' }}>
            {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
          </p>
        </div>
      </div>

      {/* Damage date verdict */}
      {damageDateObj && (
        <div style={{
          background: isDamageDay ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${isDamageDay ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: lastStorm ? 14 : 0,
        }}>
          {isDamageDay ? (
            <div style={{
              width: 24, height: 24,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 3px 10px rgba(34,197,94,0.35)',
            }}>
              <CheckCircle size={14} color="white" />
            </div>
          ) : (
            <div style={{
              width: 24, height: 24,
              background: 'rgba(245,158,11,0.25)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AlertTriangle size={14} color="#fbbf24" />
            </div>
          )}
          <div>
            <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
              Schadensdatum: {damageDateObj.toLocaleDateString('de-DE')}
            </p>
            {isDamageDay ? (
              <>
                <p style={{ color: '#4ade80', fontSize: 11, marginBottom: 4 }}>
                  ✔ Windböe ≥ Bft 8 nachgewiesen — Versicherungsvoraussetzung erfüllt
                </p>
                {nSources >= 2 && (
                  <span className={`triple-badge ${nSources >= 3 ? 'triple-3' : 'triple-2'}`}>
                    {nSources >= 3 ? '✔✔✔' : '✔✔'} Mehrfachbestätigung: {nSources} unabhängige Quellen
                    {damageEvent?.confirming_sources && (
                      <span style={{ fontWeight: 400, opacity: 0.8 }}>
                        {' '}({damageEvent.confirming_sources.join(' · ')})
                      </span>
                    )}
                  </span>
                )}
              </>
            ) : (
              <p style={{ color: '#fbbf24', fontSize: 11 }}>
                ⚠ Kein Sturm ≥ Bft 8 direkt am Schadensdatum — Zeitraum prüfen
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mini stats: Schadensdatum-Ereignis bevorzugen, sonst letzter Sturmtag */}
      {(damageEvent || lastStorm) && (() => {
        const primary = damageEvent || lastStorm
        const showLastRow = damageEvent && lastStorm &&
          new Date(lastStorm.date).toDateString() !== new Date(damageEvent.date).toDateString()
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <p style={{ color: '#94a3b8', fontSize: 9, marginBottom: 3 }}>
                  {damageEvent ? 'Am Schadensdatum' : 'Letzter Sturmtag'}
                </p>
                <p style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>
                  {new Date(primary.date).toLocaleDateString('de-DE')}
                </p>
              </div>
              <div style={{
                background: `${beaufortColor(primary.beaufort)}18`,
                border: `1px solid ${beaufortColor(primary.beaufort)}30`,
                borderRadius: 10, padding: '10px 12px',
              }}>
                <p style={{ color: '#94a3b8', fontSize: 9, marginBottom: 3 }}>Max. Böe</p>
                <p style={{ color: beaufortColor(primary.beaufort), fontSize: 12, fontWeight: 700 }}>
                  {primary.max_gust_kmh.toFixed(1)} km/h
                </p>
              </div>
              <div style={{
                background: `${beaufortColor(primary.beaufort)}18`,
                border: `1px solid ${beaufortColor(primary.beaufort)}30`,
                borderRadius: 10, padding: '10px 12px',
              }}>
                <p style={{ color: '#94a3b8', fontSize: 9, marginBottom: 3 }}>Beaufort</p>
                <p style={{ color: beaufortColor(primary.beaufort), fontSize: 12, fontWeight: 700 }}>
                  Bft {primary.beaufort} — {beaufortLabel(primary.beaufort)}
                </p>
              </div>
            </div>
            {showLastRow && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '8px 14px',
              }}>
                <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Letzter Sturmtag:
                </span>
                <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 600 }}>
                  {new Date(lastStorm.date).toLocaleDateString('de-DE')}
                </span>
                <span style={{ color: beaufortColor(lastStorm.beaufort), fontSize: 11, fontWeight: 700 }}>
                  {lastStorm.max_gust_kmh.toFixed(1)} km/h
                </span>
                <span style={{ color: beaufortColor(lastStorm.beaufort), fontSize: 10 }}>
                  · Bft {lastStorm.beaufort}
                </span>
              </div>
            )}
          </div>
        )
      })()}

      {!lastStorm && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 13, marginTop: 6 }}>
          <Cloud size={16} />
          <span>Keine Sturmtage ≥ Bft 8 im abgefragten Zeitraum</span>
        </div>
      )}
    </div>
  )
}
