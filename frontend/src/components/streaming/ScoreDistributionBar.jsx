import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const BARS = [
  { key: '0-50',   label: '0–50',   color: '#ef4444', gradId: 'grad-red'    },
  { key: '50-70',  label: '50–70',  color: '#f97316', gradId: 'grad-orange' },
  { key: '70-90',  label: '70–90',  color: '#eab308', gradId: 'grad-yellow' },
  { key: '90-100', label: '90–100', color: '#22c55e', gradId: 'grad-green'  },
]

const TOOLTIP_STYLE = {
  background: '#1a1d2e',
  border: '1px solid #2d2f45',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
}

const AXIS_TICK = { fill: '#94a3b8', fontSize: 12 }

export default function ScoreDistributionBar({ distribution = {} }) {
  const data = BARS.map(({ key, label, color, gradId }) => ({
    bracket: label,
    value: distribution[key] ?? 0,
    color,
    gradId,
  }))

  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-4"
      style={{ background: '#1a1d2e', border: '1px solid #2d2f45' }}
    >
      <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>
        Distribution des scores (% des sessions)
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <defs>
            {data.map(({ gradId, color }) => (
              <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={color} stopOpacity={0.4} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="bracket" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [`${v}%`, 'Sessions']}
            cursor={{ fill: 'rgba(99,102,241,0.08)' }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {data.map((entry) => (
              <Cell key={entry.gradId} fill={`url(#${entry.gradId})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
