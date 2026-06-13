const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

const ROW_HIGHLIGHT = {
  1: 'rgba(251,191,36,0.08)',   // gold tint
  2: 'rgba(148,163,184,0.08)',  // silver tint
  3: 'rgba(180,83,9,0.08)',     // bronze tint
}

export default function LeaderboardTable({ leaderboard = [] }) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-4"
      style={{ background: '#1a1d2e', border: '1px solid #2d2f45' }}
    >
      <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>
        Classement général — Top 10
      </p>

      {leaderboard.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '#94a3b8' }}>
          Pas encore de données
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid #2d2f45' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2d2f45' }}>
                {['Rang', 'Étudiant', 'Score total'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide"
                    style={{ color: '#94a3b8' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr
                  key={entry.rank}
                  style={{
                    background: ROW_HIGHLIGHT[entry.rank] ?? 'transparent',
                    borderBottom: '1px solid #2d2f45',
                  }}
                >
                  {/* Rank */}
                  <td className="px-4 py-3 w-16">
                    <span className="text-base">
                      {MEDALS[entry.rank] ?? (
                        <span style={{ color: '#94a3b8' }}>{entry.rank}</span>
                      )}
                    </span>
                  </td>

                  {/* Username */}
                  <td className="px-4 py-3 font-medium" style={{ color: '#e2e8f0' }}>
                    {entry.username}
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: '#6366f1' }}>
                    {entry.total_score.toLocaleString()} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
