import useAuthStore from '../store/authStore'
import { useStreamingStats } from '../hooks/useStreamingStats'
import LiveSessionCounter from '../components/streaming/LiveSessionCounter'
import DomainScoreChart from '../components/streaming/DomainScoreChart'
import HardestImagesGrid from '../components/streaming/HardestImagesGrid'
import ScoreDistributionBar from '../components/streaming/ScoreDistributionBar'
import LeaderboardTable from '../components/streaming/LeaderboardTable'

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard({ height = 200 }) {
  return (
    <div
      className="rounded-xl animate-pulse"
      style={{ background: '#1a1d2e', border: '1px solid #2d2f45', height }}
    />
  )
}

// ─── Live / Reconnecting badge ────────────────────────────────────────────────

function StatusBadge({ isConnected }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold select-none"
      style={{ background: '#1a1d2e', border: '1px solid #2d2f45' }}
    >
      {isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span style={{ color: '#f87171' }}>LIVE</span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span style={{ color: '#94a3b8' }}>Reconnexion...</span>
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ROLE_LABELS = { prof: 'Professeur', admin: 'Admin' }

export default function StreamingDashboard() {
  const role = useAuthStore((s) => s.user?.role)
  const { stats, isConnected, error } = useStreamingStats()

  return (
    <div className="min-h-full p-6 flex flex-col gap-6" style={{ background: '#0f1117' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>
            Dashboard Temps Réel
            {role && (
              <span style={{ color: '#94a3b8' }}>
                {' '}— {ROLE_LABELS[role] ?? role}
              </span>
            )}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
            Mise à jour toutes les 5 secondes
          </p>
        </div>
        <StatusBadge isConnected={isConnected} />
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {/* ── Content: skeleton while waiting for first payload ── */}
      {!stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard height={160} />
          <SkeletonCard height={300} />
          <SkeletonCard height={260} />
          <SkeletonCard height={340} />
          <SkeletonCard height={300} className="md:col-span-2" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Row 1 — counter + radar */}
          <LiveSessionCounter count={stats.active_sessions} />
          <DomainScoreChart scores={stats.avg_score_by_domain} />

          {/* Row 2 — bar chart + leaderboard */}
          <ScoreDistributionBar distribution={stats.score_distribution} />
          <LeaderboardTable leaderboard={stats.leaderboard} />

          {/* Row 3 — full width image grid */}
          <div className="md:col-span-2">
            <HardestImagesGrid images={stats.hardest_images} />
          </div>

        </div>
      )}
    </div>
  )
}
