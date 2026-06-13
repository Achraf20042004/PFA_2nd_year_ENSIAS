import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../../api/analytics'
import LoadingSpinner from '../../components/LoadingSpinner'

// ─── Domain metadata ───────────────────────────────────────────────────────

const DOMAIN = {
  pneumonie: {
    label: 'Pneumonie', sub: 'Radiologie',
    bg: 'bg-blue-50', border: 'border-blue-100',
    dot: 'bg-blue-500', text: 'text-blue-700', bar: 'bg-blue-500',
    iconBg: 'bg-blue-500/10',
  },
  melanome: {
    label: 'Dermatologie', sub: 'Mélanome',
    bg: 'bg-orange-50', border: 'border-orange-100',
    dot: 'bg-orange-500', text: 'text-orange-700', bar: 'bg-orange-500',
    iconBg: 'bg-orange-500/10',
  },
  tumeur: {
    label: 'Neurologie', sub: 'Tumeur cérébrale',
    bg: 'bg-violet-50', border: 'border-violet-100',
    dot: 'bg-violet-500', text: 'text-violet-700', bar: 'bg-violet-500',
    iconBg: 'bg-violet-500/10',
  },
}

// ─── Difficulty metadata ───────────────────────────────────────────────────

const DIFF = {
  facile:    { label: 'Facile',    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100', dot: 'bg-emerald-400' },
  moyen:     { label: 'Moyen',     cls: 'bg-amber-50 text-amber-700 border border-amber-100',       dot: 'bg-amber-400'   },
  difficile: { label: 'Difficile', cls: 'bg-red-50 text-red-700 border border-red-100',             dot: 'bg-red-400'     },
}

// ─── Primitive components ──────────────────────────────────────────────────

function Bar({ pct, colorCls = 'bg-primary', thin = false }) {
  return (
    <div className={`w-full ${thin ? 'h-1.5' : 'h-2'} bg-slate-100 rounded-full overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-500 ${colorCls}`} style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} />
    </div>
  )
}

function ScoreReadout({ score, size = 'sm' }) {
  if (score == null) return <span className={`font-heading font-bold ${size === 'lg' ? 'text-2xl' : 'text-sm'} text-slate-400`}>—</span>
  const color = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'
  return <span className={`font-heading font-bold ${size === 'lg' ? 'text-2xl' : 'text-sm'} ${color}`}>{Math.round(score)}%</span>
}

function DiffBadge({ difficulte }) {
  const d = DIFF[difficulte] ?? { label: difficulte, cls: 'bg-slate-100 text-slate-500 border border-slate-200', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${d.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
      {d.label}
    </span>
  )
}

function DomainChip({ maladie }) {
  const d = DOMAIN[maladie] ?? { label: maladie, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${d.bg} ${d.text} border ${d.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
      {d.label}
    </span>
  )
}

// ─── KPI summary card ──────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm flex flex-col gap-1 ${accent ? 'bg-primary/5 border-primary/20' : 'bg-white border-slate-100'}`}>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`font-heading font-bold text-2xl ${accent ? 'text-primary' : 'text-slate-900'}`}>{value ?? '—'}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

// ─── Exercise list item ────────────────────────────────────────────────────

function ExerciseItem({ ex, active, onClick }) {
  const d = DOMAIN[ex.maladie] ?? {}
  const scorePct = ex.avg_score ?? 0
  const barColor = scorePct >= 80 ? 'bg-emerald-400' : scorePct >= 60 ? 'bg-amber-400' : ex.avg_score == null ? 'bg-slate-200' : 'bg-red-400'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-4 transition-all border-l-2 ${
        active ? 'border-primary bg-primary/[0.04]' : 'border-transparent hover:bg-slate-50/70'
      }`}
    >
      {/* Top row: domain + difficulty */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${d.dot ?? 'bg-slate-400'}`} />
          <span className={`text-xs font-bold uppercase tracking-wide truncate ${active ? 'text-primary' : d.text ?? 'text-slate-500'}`}>
            {d.label ?? ex.maladie}
          </span>
        </div>
        <DiffBadge difficulte={ex.difficulte} />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
        <span><span className="font-semibold text-slate-600">{ex.nb_attempts}</span> tentative{ex.nb_attempts !== 1 ? 's' : ''}</span>
        <span><span className="font-semibold text-slate-600">{ex.nb_students}</span> étudiant{ex.nb_students !== 1 ? 's' : ''}</span>
        <ScoreReadout score={ex.avg_score} />
      </div>

      {/* Mini score bar */}
      <Bar pct={scorePct} colorCls={barColor} thin />
    </button>
  )
}

// ─── Exercise detail panel ─────────────────────────────────────────────────

function ExerciseDetail({ ex }) {
  const d = DOMAIN[ex.maladie] ?? {}

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="space-y-2">
            <div className="flex items-center flex-wrap gap-2">
              <DomainChip maladie={ex.maladie} />
              <DiffBadge difficulte={ex.difficulte} />
              {!ex.actif && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
                  Inactif
                </span>
              )}
            </div>
            <h3 className="font-heading font-bold text-slate-900 text-xl leading-tight">
              Exercice de {d.sub ?? d.label ?? ex.maladie}
            </h3>
            <p className="text-xs text-slate-400 font-mono">ID #{ex.id}</p>
          </div>
          <div className={`w-12 h-12 ${d.iconBg ?? 'bg-slate-100'} rounded-2xl flex items-center justify-center shrink-0`}>
            <span className={`w-5 h-5 rounded-full border-4 ${d.border ?? 'border-slate-200'} ${d.dot ? d.dot.replace('bg-', 'border-') : ''}`} />
          </div>
        </div>

        {/* 3 KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
            <p className="font-heading font-bold text-2xl text-slate-900">{ex.nb_students ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Étudiants</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
            <p className="font-heading font-bold text-2xl text-slate-900">{ex.nb_attempts ?? 0}</p>
            <p className="text-[11px] text-slate-400 mt-1">Tentatives</p>
          </div>
          <div className={`${d.bg ?? 'bg-slate-50'} rounded-xl p-4 text-center border ${d.border ?? 'border-slate-100'}`}>
            <ScoreReadout score={ex.avg_score} size="lg" />
            <p className="text-[11px] text-slate-400 mt-1">Score moyen</p>
          </div>
        </div>

        {/* Score bar */}
        {ex.avg_score != null && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Performance globale</p>
              <p className="text-xs text-slate-400">{Math.round(ex.avg_score)}% de réussite moyenne</p>
            </div>
            <Bar
              pct={ex.avg_score}
              colorCls={ex.avg_score >= 80 ? 'bg-emerald-400' : ex.avg_score >= 60 ? 'bg-amber-400' : 'bg-red-400'}
            />
          </div>
        )}
      </div>

      {/* Hardest images */}
      {ex.hardest_images?.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center shrink-0 border border-red-100">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008Zm-9.303-3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Images les plus difficiles</p>
              <p className="text-xs text-slate-400">Classées par taux d'erreur décroissant</p>
            </div>
          </div>
          <div className="space-y-3.5">
            {ex.hardest_images.slice(0, 5).map((img, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-500">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-slate-600 truncate">Image {i + 1}</p>
                    <span className="text-[11px] font-bold text-red-500 shrink-0 ml-2">
                      {img.error_rate != null ? `${(img.error_rate * 100).toFixed(0)}% d'erreur` : '—'}
                    </span>
                  </div>
                  <Bar pct={img.error_rate != null ? img.error_rate * 100 : 0} colorCls="bg-red-400" thin />
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{img.error_count} ✗</span>
              </div>
            ))}
          </div>
        </div>
      ) : ex.nb_attempts > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
          <p className="text-xs text-slate-400">Toutes les images ont été bien diagnostiquées.</p>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 text-center">
          <p className="text-xs text-slate-400">Aucune tentative pour cet exercice.</p>
          <p className="text-[11px] text-slate-300 mt-1">Les statistiques apparaîtront après la première session étudiante.</p>
        </div>
      )}
    </div>
  )
}

// ─── AI model metric card ──────────────────────────────────────────────────

const ALL_DOMAINS = ['pneumonie', 'melanome', 'tumeur']

function ModelCard({ maladie, metric }) {
  const d = DOMAIN[maladie] ?? { label: maladie, sub: '', bg: 'bg-slate-50', border: 'border-slate-100', dot: 'bg-slate-400', text: 'text-slate-500', bar: 'bg-slate-400', iconBg: 'bg-slate-100' }
  const conf = metric?.avg_confidence
  const confPct = conf != null ? conf * 100 : null

  return (
    <div className={`rounded-2xl border ${d.border} ${d.bg} p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full ${d.dot}`} />
            <p className={`text-xs font-bold uppercase tracking-widest ${d.text}`}>{d.label}</p>
          </div>
          <p className="font-heading font-semibold text-slate-800 text-sm">{d.sub}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${
          metric ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${metric ? 'bg-emerald-400' : 'bg-slate-300'}`} />
          {metric ? 'Actif' : 'En attente'}
        </div>
      </div>

      {metric ? (
        <>
          {/* Confidence */}
          <div>
            <div className="flex items-end justify-between mb-2">
              <p className="text-xs font-medium text-slate-500">Confiance IA</p>
              <p className={`font-heading font-bold text-lg ${d.text}`}>
                {confPct != null ? `${confPct.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="h-2.5 bg-white/70 rounded-full overflow-hidden">
              {confPct != null && (
                <div className={`h-full ${d.bar} rounded-full transition-all duration-700`} style={{ width: `${confPct}%` }} />
              )}
            </div>
          </div>

          {/* Stats chips */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/70 rounded-xl p-3 text-center border border-white/50">
              <p className="font-heading font-bold text-slate-800">{metric.sample_count ?? '—'}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Inférences</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3 text-center border border-white/50">
              <p className="font-heading font-bold text-slate-800">
                {metric.avg_latency_ms != null ? `${Math.round(metric.avg_latency_ms)} ms` : '—'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Latence moy.</p>
            </div>
          </div>

          {/* Model ID */}
          {metric.model_id && (
            <p className="text-[10px] text-slate-400 font-mono truncate leading-relaxed" title={metric.model_id}>
              {metric.model_id}
            </p>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-4 gap-2">
          <div className="w-8 h-8 bg-slate-200/60 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
            </svg>
          </div>
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            Aucune donnée.<br />
            <span className="text-[11px] text-slate-300">Disponible après les premières sessions.</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ProfAnalyticsPage() {
  const [selectedId, setSelectedId] = useState(null)

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['analytics', 'prof'],
    queryFn: () => analyticsApi.profDashboard(),
  })

  const { data: metricsRaw } = useQuery({
    queryKey: ['analytics', 'metrics'],
    queryFn: () => analyticsApi.modelMetrics(),
  })

  const exercises = dashboard?.exercises ?? []
  const selected = selectedId
    ? exercises.find((e) => e.id === selectedId)
    : exercises[0] ?? null

  // metrics indexed by maladie
  const metricsList = metricsRaw?.results ?? metricsRaw ?? []
  const metricsMap = Object.fromEntries(metricsList.map((m) => [m.maladie, m]))

  // domains to show in metric section — prof's domains, else all 3
  const profDomains = [...new Set(exercises.map((e) => e.maladie))]
  const displayDomains = profDomains.length > 0 ? profDomains : ALL_DOMAINS

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* ── Page header ── */}
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Analytics</h1>
          <p className="text-slate-500 text-sm">Performances de vos exercices · qualité des modèles IA · retours étudiants</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="space-y-8">

          {/* ── Global KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              accent
              label="Exercices actifs"
              value={exercises.filter((e) => e.actif !== false).length}
              sub={`${exercises.length} exercice${exercises.length !== 1 ? 's' : ''} au total`}
            />
            <KpiCard
              label="Étudiants uniques"
              value={dashboard?.total_students ?? 0}
              sub="Ont tenté ≥ 1 exercice"
            />
            <KpiCard
              label="Tentatives totales"
              value={dashboard?.total_attempts ?? 0}
            />
            <KpiCard
              label="Score moyen global"
              value={dashboard?.avg_score != null ? `${Math.round(dashboard.avg_score)}%` : '—'}
            />
          </div>

          {/* ── Exercises section ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-slate-900 text-lg">Exercices</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                {exercises.length} exercice{exercises.length !== 1 ? 's' : ''}
              </span>
            </div>

            {exercises.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500 font-medium mb-1">Aucun exercice créé</p>
                <p className="text-xs text-slate-400">Créez votre premier exercice depuis la page <strong>Mes Exercices</strong>.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Exercise list */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-50">
                    {exercises.map((ex) => (
                      <ExerciseItem
                        key={ex.id}
                        ex={ex}
                        active={selected?.id === ex.id}
                        onClick={() => setSelectedId(ex.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Detail panel */}
                <div className="lg:col-span-2">
                  {selected
                    ? <ExerciseDetail ex={selected} />
                    : (
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center h-full flex items-center justify-center">
                        <p className="text-sm text-slate-400">Sélectionnez un exercice.</p>
                      </div>
                    )
                  }
                </div>
              </div>
            )}
          </div>

          {/* ── AI Model Metrics ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-heading font-semibold text-slate-900 text-lg">Métriques des modèles IA</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">HuggingFace Transformers</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {displayDomains.map((maladie) => (
                <ModelCard key={maladie} maladie={maladie} metric={metricsMap[maladie] ?? null} />
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
