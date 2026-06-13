import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { resultsApi } from '../../api/results'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconChart, IconClock, IconChevronRight } from '../../components/icons'

// ─── Domain config ────────────────────────────────────────────────────────────

const DOMAIN = {
  pneumonie: {
    label: 'Pneumonie',
    sub: 'Radiologie',
    dot: 'bg-blue-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    bar: 'bg-blue-500',
    accent: '#3b82f6',
    icon: '🫁',
  },
  melanome: {
    label: 'Mélanome',
    sub: 'Dermatologie',
    dot: 'bg-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    bar: 'bg-orange-500',
    accent: '#f97316',
    icon: '🔬',
  },
  tumeur: {
    label: 'Tumeur cérébrale',
    sub: 'Neurologie',
    dot: 'bg-violet-500',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    bar: 'bg-violet-500',
    accent: '#7c3aed',
    icon: '🧠',
  },
}

const DEFAULT_DOMAIN = {
  label: '—', sub: '', dot: 'bg-slate-400', bg: 'bg-slate-50',
  text: 'text-slate-600', border: 'border-slate-200', bar: 'bg-slate-400',
  accent: '#94a3b8', icon: '📋',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(raw) {
  if (!raw) return '—'
  const d = new Date(raw)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(raw) {
  if (!raw) return '—'
  const d = new Date(raw)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(s) {
  if (!s) return null
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function getScoreStyle(pct) {
  if (pct >= 80) return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500' }
  if (pct >= 60) return { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   bar: 'bg-amber-400'   }
  return              { color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     bar: 'bg-red-400'     }
}

// Group attempts by month
function groupByMonth(attempts) {
  const groups = {}
  for (const a of attempts) {
    const d   = new Date(a.date ?? a.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const lbl = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = { label: lbl, items: [] }
    groups[key].items.push(a)
  }
  return Object.values(groups)
}

// ─── Attempt card ─────────────────────────────────────────────────────────────

function AttemptCard({ attempt, index }) {
  const exercise = attempt.exercise ?? {}
  const dm       = DOMAIN[exercise.maladie] ?? DEFAULT_DOMAIN
  const isExam   = attempt.mode === 'exam'
  const rawScore = attempt.score ?? null

  // Determine if the score is a decimal (0-1) or already a percentage
  const pct = rawScore != null
    ? rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore)
    : null

  const showScore = pct != null && pct > 0
  const ss        = showScore ? getScoreStyle(pct) : null

  // Meaningful title: prefer exercise.titre, fallback to domain label + mode
  const title = exercise.titre
    || (dm.label !== '—'
      ? `${dm.label} — ${isExam ? 'Examen' : 'Entraînement'}`
      : `Session ${attempt.id}`)

  const duration = formatDuration(attempt.duree_reelle)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, duration: 0.25, ease: 'easeOut' }}
    >
      <Link
        to={exercise.id ? `/exercises/${exercise.id}/feedback/${attempt.id}` : '#'}
        className="group flex items-stretch bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200 overflow-hidden"
      >
        {/* Left accent stripe */}
        <div
          className="w-1 shrink-0 rounded-l-2xl"
          style={{ background: dm.accent }}
        />

        {/* Domain icon */}
        <div className={`shrink-0 flex items-center justify-center w-14 ${dm.bg}`}>
          <span className="text-2xl">{dm.icon}</span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 px-4 py-3.5">
          {/* Title + badges */}
          <div className="flex items-start gap-2 mb-1.5 flex-wrap">
            <p className="text-sm font-bold text-slate-800 leading-snug truncate flex-1 min-w-0">
              {title}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {isExam && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-white rounded-full tracking-wide">
                  EXAMEN
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dm.bg} ${dm.text}`}>
                {dm.sub || dm.label}
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span>{formatDate(attempt.date ?? attempt.created_at)}</span>
            <span className="text-slate-200">·</span>
            <span>{formatTime(attempt.date ?? attempt.created_at)}</span>
            {duration && (
              <>
                <span className="text-slate-200">·</span>
                <span className="flex items-center gap-1">
                  <IconClock className="w-3 h-3" />
                  {duration}
                </span>
              </>
            )}
          </div>

          {/* Score bar — only if score is meaningful */}
          {showScore && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: index * 0.035 + 0.2, duration: 0.6, ease: 'easeOut' }}
                  className={`h-full rounded-full ${ss.bar}`}
                />
              </div>
              <span className={`text-xs font-bold tabular-nums ${ss.color}`}>{pct}%</span>
            </div>
          )}
        </div>

        {/* Right arrow */}
        <div className="shrink-0 flex items-center pr-4 pl-2">
          <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const FILTERS = [
  { value: 'all',      label: 'Tout' },
  { value: 'practice', label: 'Entraînement' },
  { value: 'exam',     label: 'Examens' },
]

export default function HistoryPage() {
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')

  const { data: history, isLoading } = useQuery({
    queryKey: ['results', 'me'],
    queryFn:  resultsApi.me,
  })

  const all = history?.results ?? []

  const filtered = all
    .filter((a) => filter === 'all' || a.mode === filter)
    .sort((a, b) => {
      if (sortBy === 'score') {
        const sa = a.score ?? 0
        const sb = b.score ?? 0
        return sb - sa
      }
      return new Date(b.date ?? b.created_at) - new Date(a.date ?? a.created_at)
    })

  const avgRaw = history?.average_score
  const avg    = avgRaw != null
    ? (avgRaw <= 1 ? Math.round(avgRaw * 100) : Math.round(avgRaw))
    : null

  const successCount = all.filter((a) => {
    const s = a.score ?? 0
    return (s <= 1 ? s * 100 : s) >= 80
  }).length

  // Domain breakdown
  const domainCounts = Object.entries(DOMAIN).map(([key, meta]) => ({
    key, meta,
    count: all.filter((a) => a.exercise?.maladie === key).length,
  })).filter((d) => d.count > 0)

  const groups = sortBy === 'date' ? groupByMonth(filtered) : [{ label: null, items: filtered }]

  return (
    <div className="p-6 max-w-3xl mx-auto animate-page">

      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-slate-900">Historique</h1>
        <p className="text-slate-400 text-sm mt-0.5">{all.length} session{all.length !== 1 ? 's' : ''} enregistrée{all.length !== 1 ? 's' : ''}</p>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="font-heading font-bold text-2xl text-slate-900">{all.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Sessions totales</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="font-heading font-bold text-2xl text-[#1B5E3B]">
            {avg != null ? `${avg}%` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Score moyen</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="font-heading font-bold text-2xl text-slate-900">{successCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">Réussites ≥ 80%</p>
        </div>
      </div>

      {/* ── Domain chips ── */}
      {domainCounts.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {domainCounts.map(({ key, meta, count }) => (
            <button
              key={key}
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${meta.bg} ${meta.text} ${meta.border}`}
            >
              <span>{meta.icon}</span>
              {meta.label}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/60`}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Filters + sort ── */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                filter === f.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B5E3B]/20 text-slate-600 font-medium"
        >
          <option value="date">Plus récentes</option>
          <option value="score">Meilleur score</option>
        </select>
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <IconChart className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-400">Aucune session pour ce filtre</p>
          <p className="text-xs text-slate-300 mt-1">Essayez un autre filtre ou commencez un exercice</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label ?? 'all'}>
              {group.label && (
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest capitalize">
                    {group.label}
                  </p>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-300 font-medium">{group.items.length}</span>
                </div>
              )}
              <div className="space-y-2.5">
                {group.items.map((attempt, i) => (
                  <AttemptCard key={attempt.id} attempt={attempt} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
