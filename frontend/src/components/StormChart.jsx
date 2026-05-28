import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, Legend
} from 'recharts'
import { beaufortColor } from '../utils/beaufort'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p className="text-blue-700">Böe: <b>{d.gust?.toFixed(1)} km/h</b></p>
      <p className="text-gray-600">Beaufort: <b>Bft {d.beaufort}</b></p>
      {d.mean_wind && <p className="text-gray-500">Mittelwind: {d.mean_wind?.toFixed(1)} km/h</p>}
      <p className="text-gray-400 text-xs mt-1">{d.source}</p>
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

  // Schadensdatum im Chart markieren
  const damageDateStr = damageDate
    ? new Date(damageDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-blue-900 mb-3">Sturmtage im Zeitraum</h3>
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          Keine Sturmtage im ausgewählten Zeitraum
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-blue-900">
          Windböen im Auswertungszeitraum
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-500 inline-block"></span>
            Bft 8 (62 km/h)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-800 inline-block border-dashed border-t border-red-800"></span>
            Bft 9 (75 km/h)
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[50, 'auto']}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            label={{ value: 'km/h', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={62} stroke="#ef4444" strokeDasharray="4 2"
            label={{ value: 'Bft 8', fill: '#ef4444', fontSize: 10, position: 'right' }} />
          <ReferenceLine y={75} stroke="#7f1d1d" strokeDasharray="2 4"
            label={{ value: 'Bft 9', fill: '#7f1d1d', fontSize: 10, position: 'right' }} />
          {damageDateStr && (
            <ReferenceLine x={damageDateStr} stroke="#1d4ed8" strokeWidth={2}
              label={{ value: 'Schaden', fill: '#1d4ed8', fontSize: 10 }} />
          )}
          <Bar dataKey="gust" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={beaufortColor(entry.beaufort)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Beaufort-Legende */}
      <div className="flex flex-wrap gap-2 mt-2 justify-center">
        {[
          { bft: 8, label: 'Bft 8 — Stürmischer Wind' },
          { bft: 9, label: 'Bft 9 — Sturm' },
          { bft: 10, label: 'Bft 10 — Schwerer Sturm' },
          { bft: 11, label: 'Bft 11+' },
        ].filter(b => stormDays.some(e => e.beaufort >= b.bft)).map(b => (
          <span key={b.bft} className="flex items-center gap-1 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm inline-block"
              style={{ backgroundColor: beaufortColor(b.bft) }}></span>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}
