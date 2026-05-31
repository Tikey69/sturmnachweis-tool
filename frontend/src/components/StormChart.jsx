import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { beaufortColor } from '../utils/beaufort'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'rgba(15,25,60,0.92)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ color: 'white', fontWeight: 700, marginBottom: 5 }}>{label}</p>
      <p style={{ color: '#93c5fd', marginBottom: 2 }}>
        Böe: <b>{d.gust?.toFixed(1)} km/h</b>
      </p>
      <p style={{ color: '#e2e8f0', marginBottom: 2 }}>
        Beaufort: <b>Bft {d.beaufort}</b>
      </p>
      {d.mean_wind && (
        <p style={{ color: '#94a3b8', marginBottom: 2 }}>
          Mittelwind: {d.mean_wind?.toFixed(1)} km/h
        </p>
      )}
      <p style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>{d.source}</p>
    </div>
  )
}

export default function StormChart({ stormDays, damageDate }) {
  const sorted = [...stormDays].sort((a, b) => new Date(a.date) - new Date(b.date))

  const data = sorted.map(e => ({
    date: new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    gust: e.max_gust_kmh,
    beaufort: e.beaufort,
    mean_wind: e.mean_wind_kmh,
    source: e.source,
    rawDate: e.date,
  }))

  const damageDateStr = damageDate
    ? new Date(damageDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null

  if (data.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Sturmtage im Zeitraum</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#475569', fontSize: 13 }}>
          Keine Sturmtage im ausgewählten Zeitraum
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
            Windböen im Auswertungszeitraum
          </h3>
          <p style={{ color: '#94a3b8', fontSize: 10 }}>Maximale Böen je Sturmtag in km/h</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#cbd5e1', fontSize: 10 }}>
            <span style={{ width: 14, height: 2, background: '#ef4444', display: 'inline-block', borderTop: '2px dashed #ef4444' }} />
            Bft 8 (62 km/h)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#cbd5e1', fontSize: 10 }}>
            <span style={{ width: 14, height: 2, background: '#7f1d1d', display: 'inline-block', borderTop: '2px dashed #7f1d1d' }} />
            Bft 9 (75 km/h)
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={data} margin={{ top: 10, right: 14, left: 0, bottom: 44 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#ffffff', fontWeight: 600 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[50, 'auto']}
            tick={{ fontSize: 11, fill: '#ffffff', fontWeight: 600 }}
            label={{ value: 'km/h', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#cbd5e1' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={62} stroke="#ef4444" strokeDasharray="4 2"
            label={{ value: 'Bft 8', fill: '#ef4444', fontSize: 10, position: 'right' }} />
          <ReferenceLine y={75} stroke="#7f1d1d" strokeDasharray="2 4"
            label={{ value: 'Bft 9', fill: '#7f1d1d', fontSize: 10, position: 'right' }} />
          {damageDateStr && (
            <ReferenceLine x={damageDateStr} stroke="#3b82f6" strokeWidth={2}
              label={{ value: 'Schaden', fill: '#3b82f6', fontSize: 10 }} />
          )}
          <Bar dataKey="gust" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={beaufortColor(entry.beaufort)}
                fillOpacity={entry.date === damageDateStr ? 1 : 0.82}
                style={entry.date === damageDateStr ? {
                  filter: `drop-shadow(0 0 6px ${beaufortColor(entry.beaufort)}88)`,
                } : {}}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Beaufort legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4, justifyContent: 'center' }}>
        {[
          { bft: 8, label: 'Bft 8 — Stürmischer Wind' },
          { bft: 9, label: 'Bft 9 — Sturm' },
          { bft: 10, label: 'Bft 10 — Schwerer Sturm' },
          { bft: 11, label: 'Bft 11+' },
        ].filter(b => stormDays.some(e => e.beaufort >= b.bft)).map(b => (
          <span key={b.bft} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#cbd5e1', fontSize: 10 }}>
            <span style={{
              width: 11, height: 11, borderRadius: 3,
              background: beaufortColor(b.bft),
              display: 'inline-block',
            }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}
