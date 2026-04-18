import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { resultsApi } from '../../api/results'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconChart, IconClock, IconChevronRight } from '../../components/icons'

const DOMAIN_META = {
  pneumonie: { label: 'Radiologie', dot: 'bg-blue-500', bg: 'bg-blue-50' },
  melanome: { label: 'Dermatologie', dot: 'bg-orange-500', bg: 'bg-orange-50' },
  retinopathie: { label: 'Ophtalmologie', dot: 'bg-violet-500', bg: 'bg-violet-50' },
}

function scoreColor(score) {
  if (score >= 80) return 'text-primary bg-primary/10'
  if (score >= 60) return 'text-amber-700 bg-amber-100'
  return 'text-red-700 bg-red-100'
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function AttemptRow({ attempt }) {
  const exercise = attempt.exercise ?? {}
  const domain = DOMAIN_META[exercise.maladie] ?? { label: exercise.maladie ?? '—', dot: 'bg-slate-400', bg: 'bg-slate-50' }
  const score = attempt.score ?? 0
  const date = new Date(attempt.date ?? attempt.created_at)
  const isExam = attempt.mode === 'exam'

  return (
    <Link
      to={`/exercises/${exercise.id ?? ''}/feedback/${attempt.id}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
    >
      {/* Domain icon */}
      <div className={`w-9 h-9 ${domain.bg} rounded-xl flex items-center justify-center shrink-0`}>
        <div className={`w-3 h-3 rounded-full ${domain.dot}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-slate-800 truncate">
            {exercise.titre ?? `Exercice #${exercise.id ?? '?'}`}
          </p>
          {isExam && (
            <span className="text-xs px-1.5 py-0.5 bg-slate-900 text-white rounded-full font-medium shrink-0">Examen</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <IconClock className="w-3.5 h-3.5" />
            {formatDuration(attempt.duree_reelle)}
          </span>
          <span>·</span>
          <span>{domain.label}</span>
        </div>
      </div>

      {/* Score badge */}
      <span className={`font-heading font-bold text-sm px-3 py-1.5 rounded-xl ${scoreColor(score)}`}>
        {Math.round(score)}%
      </span>

      <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
    </Link>
  )
}

const FILTERS = [
  { value: 'all', label: 'Tout' },
  { value: 'practice', label: 'Entraînement' },
  { value: 'exam', label: 'Examens' },
]

export default function HistoryPage() {
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')

  const { data: history, isLoading } = useQuery({
    queryKey: ['results', 'me'],
    queryFn: resultsApi.me,
  })

  const allAttempts = history?.results ?? []

  const filtered = allAttempts
    .filter((a) => filter === 'all' || a.mode === filter)
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.date ?? b.created_at) - new Date(a.date ?? a.created_at)
      if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0)
      return 0
    })

  const avgScore = filtered.length > 0
    ? filtered.reduce((sum, a) => sum + (a.score ?? 0), 0) / filtered.length
    : null

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Historique</h1>
        <p className="text-slate-500 text-sm">{allAttempts.length} tentative{allAttempts.length !== 1 ? 's' : ''} au total</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-sm">
          <p className="font-heading font-bold text-2xl text-slate-900">{allAttempts.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Sessions totales</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-sm">
          <p className="font-heading font-bold text-2xl text-primary">
            {history?.average_score != null ? `${Math.round(history.average_score)}%` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Score moyen global</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-sm">
          <p className="font-heading font-bold text-2xl text-slate-900">
            {allAttempts.filter((a) => (a.score ?? 0) >= 80).length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Réussites (≥80%)</p>
        </div>
      </div>

      {/* Filters + sort */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-primary text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-sm px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="date">Plus récentes</option>
          <option value="score">Meilleur score</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <IconChart className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucune tentative pour ce filtre.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((attempt) => (
              <AttemptRow key={attempt.id} attempt={attempt} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
