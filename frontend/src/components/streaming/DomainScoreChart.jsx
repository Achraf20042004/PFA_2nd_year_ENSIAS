import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

const TOOLTIP_STYLE = {
  background: '#1a1d2e',
  border: '1px solid #2d2f45',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

export default function DomainScoreChart({ scores = {} }) {
  const data = [
    { domain: 'Pneumonie',    score: scores.radiologie   ?? 0 },
    { domain: 'Dermatologie', score: scores.dermatologie ?? 0 },
    { domain: 'Neurologie',    score: scores.neurologie    ?? 0 },
  ]

  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-4"
      style={{ background: '#1a1d2e', border: '1px solid #2d2f45' }}
    >
      <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>
        Score moyen par domaine
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#2d2f45" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickCount={4}
          />
          <Radar
            dataKey="score"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.3}
            dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [`${v.toFixed(1)}%`, 'Score moyen']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
