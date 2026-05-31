import { beaufortColor, beaufortLabel } from '../utils/beaufort'

function SourceBadges({ event }) {
  const sources = event.confirming_sources?.length ? event.confirming_sources : [event.source]
  const n = sources.length

  const badgeClass = (src) => {
    if (src.includes('DWD'))    return 'src-badge src-badge-amber'
    if (src.includes('KNMI'))   return 'src-badge src-badge-green'
    if (src.includes('Visual')) return 'src-badge src-badge-purple'
    return 'src-badge src-badge-blue'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {n >= 2 && (
        <span className={`triple-badge ${n >= 3 ? 'triple-3' : 'triple-2'}`}>
          {n >= 3 ? '✔✔✔' : '✔✔'} {n} Quellen bestätigt
        </span>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {sources.map(src => (
          <span key={src} className={badgeClass(src)}>{src}</span>
        ))}
      </div>
    </div>
  )
}

export default function ResultsTable({ stormDays, damageDate }) {
  const sorted = [...stormDays].sort((a, b) => new Date(b.date) - new Date(a.date))
  const damageDateObj = damageDate ? new Date(damageDate) : null

  return (
    <div className="glass-card" style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <h3 style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
          Nachgewiesene Sturmtage ({stormDays.length})
        </h3>
        <p style={{ color: '#cbd5e1', fontSize: 12 }}>
          Tage mit maximaler Windböe ≥ 62 km/h (Beaufort 8) — Farbe zeigt Mehrfachbestätigung durch unabhängige Quellen
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(10,20,50,0.5)' }}>
              {['Datum', 'Max. Böe (km/h)', 'Max. Böe (m/s)', 'Beaufort', 'Mittelwind', 'Bestätigende Quellen', 'Station'].map((h, i) => (
                <th key={h} style={{
                  color: '#cbd5e1',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  padding: '11px 16px',
                  textAlign: i >= 1 && i <= 4 ? (i === 3 ? 'center' : 'right') : 'left',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((event, i) => {
              const eventDate = new Date(event.date)
              const isDamageDay = damageDateObj && Math.abs(eventDate - damageDateObj) <= 86400000
              const n = event.confirming_sources?.length || 1

              const rowBg = isDamageDay
                ? 'rgba(59,130,246,0.08)'
                : n >= 3 ? 'rgba(34,197,94,0.05)'
                : n === 2 ? 'rgba(245,158,11,0.05)'
                : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'

              return (
                <tr key={i} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: rowBg,
                  cursor: 'default',
                }}>
                  <td style={{ padding: '11px 16px', color: 'white', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {eventDate.toLocaleDateString('de-DE')}
                    {isDamageDay && (
                      <span style={{
                        marginLeft: 6,
                        background: 'rgba(59,130,246,0.2)',
                        border: '1px solid rgba(59,130,246,0.35)',
                        color: '#93c5fd',
                        fontSize: 10, fontWeight: 700,
                        padding: '1px 6px', borderRadius: 4,
                      }}>
                        Schadensdatum
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: beaufortColor(event.beaufort), fontSize: 13 }}>
                    {event.max_gust_kmh.toFixed(1)}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', color: 'white', fontSize: 13 }}>
                    {event.max_gust_ms.toFixed(1)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span className="bft-badge" style={{
                      background: `${beaufortColor(event.beaufort)}22`,
                      border: `1px solid ${beaufortColor(event.beaufort)}44`,
                      color: beaufortColor(event.beaufort),
                    }}>
                      Bft {event.beaufort}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', color: 'white', fontSize: 13 }}>
                    {event.mean_wind_kmh ? `${event.mean_wind_kmh.toFixed(1)} km/h` : '—'}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <SourceBadges event={event} />
                  </td>
                  <td style={{ padding: '11px 16px', color: '#cbd5e1', fontSize: 12 }}>
                    {event.station_name || '—'}
                    {event.distance_km > 0 && (
                      <span style={{ color: '#94a3b8', marginLeft: 4 }}>({event.distance_km} km)</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {stormDays.length === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          Keine Sturmtage ≥ Bft 8 im ausgewählten Zeitraum gefunden.
        </div>
      )}

      {/* Legend */}
      {stormDays.some(e => (e.confirming_sources?.length || 1) >= 2) && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.15)',
          display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
          fontSize: 12,
        }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Farbcode:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#cbd5e1' }}>
            <span style={{ width: 11, height: 11, borderRadius: 2, background: 'rgba(245,158,11,0.35)', border: '1px solid rgba(245,158,11,0.4)', display: 'inline-block' }} />
            2 Quellen bestätigt
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#cbd5e1' }}>
            <span style={{ width: 11, height: 11, borderRadius: 2, background: 'rgba(34,197,94,0.3)', border: '1px solid rgba(34,197,94,0.4)', display: 'inline-block' }} />
            3+ Quellen (höchste Sicherheit)
          </span>
        </div>
      )}
    </div>
  )
}
