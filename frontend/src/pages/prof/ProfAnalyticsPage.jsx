import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../../api/analytics'
import { exercisesApi } from '../../api/exercises'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconChart, IconUser, IconBook } from '../../components/icons'

const DOMAIN_META = {
  pneumonie: { label: 'Radiologie', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  melanome: { label: 'Dermatologie', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  retinopathie: { label: 'Ophtalmologie', bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
}

function ScoreBar({ score, max = 100 }) {
  const pct = Math.min(100, Math.max(0, ((score ?? 0) / max) * 100))
  const color = score >= 80 ? 'bg-primary' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-slate-700 w-12 text-right">
        {score != null ? `${Math.round(score)}%` : '—'}
      </span>
    </div>
  )
}

function MetricCard({ label, value, sub, color = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`font-heading font-bold text-2xl ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ProfAnalyticsPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState(null)

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['analytics', 'prof'],
    queryFn: () => analyticsApi.profDashboard(),
  })

  const { data: metrics } = useQuery({
    queryKey: ['analytics', 'metrics'],
    queryFn: () => analyticsApi.modelMetrics(),
  })

  const exercises = dashboard?.exercises ?? []
  const selected = selectedExerciseId
    ? exercises.find((e) => e.id === selectedExerciseId)
    : exercises[0] ?? null

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Analytics</h1>
        <p className="text-slate-500 text-sm">Performances de vos exercices et retours étudiants.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {/* Global stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard label="Exercices actifs" value={exercises.filter((e) => e.actif !== false).length} sub={`${exercises.length} au total`} color="text-primary" />
            <MetricCard label="Étudiants uniques" value={dashboard?.total_students ?? 0} sub="Ont tenté ≥1 exercice" />
            <MetricCard label="Tentatives totales" value={dashboard?.total_attempts ?? 0} />
            <MetricCard
              label="Score moyen global"
              value={dashboard?.avg_score != null ? `${Math.round(dashboard.avg_score)}%` : '—'}
              color={dashboard?.avg_score >= 80 ? 'text-primary' : dashboard?.avg_score >= 60 ? 'text-amber-600' : 'text-red-600'}
            />
          </div>

          {/* Exercise selector + detail */}
          {exercises.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Exercise list */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="px-4 py-3.5 border-b border-slate-100">
                  <p className="font-heading font-semibold text-slate-900 text-sm">Exercices</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {exercises.map((ex) => {
                    const d = DOMAIN_META[ex.maladie] ?? {}
                    const isActive = (selected?.id ?? exercises[0]?.id) === ex.id
                    return (
                      <button
                        key={ex.id}
                        onClick={() => setSelectedExerciseId(ex.id)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${isActive ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                      >
                        <div className={`w-7 h-7 ${d.bg ?? 'bg-slate-100'} rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>
                          <div className={`w-2 h-2 rounded-full ${d.dot ?? 'bg-slate-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-slate-800'}`}>
                            {ex.titre ?? `Exercice #${ex.id}`}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{ex.nb_attempts ?? 0} tentatives</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Detail panel */}
              {selected && (
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-heading font-semibold text-slate-900">{selected.titre ?? `Exercice #${selected.id}`}</h3>
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${DOMAIN_META[selected.maladie]?.bg ?? 'bg-slate-100'} ${DOMAIN_META[selected.maladie]?.text ?? 'text-slate-600'}`}>
                        {DOMAIN_META[selected.maladie]?.label ?? selected.maladie}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="font-heading font-bold text-xl text-slate-900">{selected.nb_students ?? 0}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Étudiants</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="font-heading font-bold text-xl text-slate-900">{selected.nb_attempts ?? 0}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Tentatives</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className={`font-heading font-bold text-xl ${selected.avg_score >= 80 ? 'text-primary' : selected.avg_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                          {selected.avg_score != null ? `${Math.round(selected.avg_score)}%` : '—'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">Score moy.</p>
                      </div>
                    </div>

                    {/* Score distribution */}
                    {selected.score_distribution && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Distribution des scores</p>
                        {Object.entries(selected.score_distribution).map(([range, count]) => (
                          <div key={range} className="flex items-center gap-3 mb-2">
                            <span className="text-xs text-slate-500 w-16 shrink-0">{range}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${selected.nb_attempts > 0 ? (count / selected.nb_attempts) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-6 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hardest images */}
                  {selected.hardest_images?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Images les plus difficiles</p>
                      <div className="space-y-2">
                        {selected.hardest_images.slice(0, 5).map((img, i) => (
                          <div key={img.id ?? i} className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                            <span className="text-xs text-slate-600 flex-1 truncate">Image #{img.id ?? i + 1}</span>
                            <div className="w-32"><ScoreBar score={img.error_rate != null ? (1 - img.error_rate) * 100 : null} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Model metrics */}
          {metrics && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-heading font-semibold text-slate-900 text-base">Métriques des modèles IA</h2>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(metrics?.results ?? metrics ?? []).map((m, i) => {
                  const d = DOMAIN_META[m.maladie] ?? {}
                  return (
                    <div key={i} className={`${d.bg ?? 'bg-slate-50'} rounded-xl p-4 border ${d.bg ? 'border-transparent' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${d.dot ?? 'bg-slate-400'}`} />
                        <p className={`text-xs font-semibold uppercase tracking-wide ${d.text ?? 'text-slate-600'}`}>{d.label ?? m.maladie}</p>
                      </div>
                      <p className="text-xs text-slate-500 mb-0.5">{m.metric_name ?? 'accuracy'}</p>
                      <ScoreBar score={m.metric_value != null ? m.metric_value * 100 : null} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
