import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../../api/analytics'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconAnalytics } from '../../components/icons'

const DOMAIN_META = {
  pneumonie: {
    label: 'Pneumonie',
    sub: 'Radiologie',
    model: 'nickmuchi/vit-finetuned-chest-xray-pneumonia',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    bar: 'bg-blue-500',
  },
  melanome: {
    label: 'Dermatologie',
    sub: 'Mélanome',
    model: 'anonymous-german-shepherd/skin-cancer',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    bar: 'bg-orange-500',
  },
  tumeur: {
    label: 'Neurologie',
    sub: 'Tumeur cérébrale',
    model: 'Devarshi/Brain-Tumor-Classification',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    bar: 'bg-violet-500',
  },
}

function MetricBar({ value, bar = 'bg-primary' }) {
  const pct = value != null ? Math.min(100, Math.max(0, value * 100)) : null
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        {pct != null && <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct}%` }} />}
      </div>
      <span className="text-sm font-bold text-slate-700 w-12 text-right">
        {pct != null ? `${pct.toFixed(1)}%` : '—'}
      </span>
    </div>
  )
}

function DomainCard({ maladie, metricGroups }) {
  const d = DOMAIN_META[maladie] ?? { label: maladie, sub: '', model: '', bg: 'bg-slate-50', border: 'border-slate-100', dot: 'bg-slate-400', text: 'text-slate-600', bar: 'bg-slate-400' }

  return (
    <div className={`${d.bg} rounded-2xl border ${d.border} p-5`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2.5 h-2.5 rounded-full ${d.dot}`} />
            <p className={`text-xs font-bold uppercase tracking-wide ${d.text}`}>{d.label}</p>
          </div>
          <p className="font-heading font-bold text-slate-900 text-lg">{d.sub}</p>
          <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{d.model}</p>
        </div>
      </div>

      {/* Metrics */}
      {metricGroups.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune métrique disponible.</p>
      ) : (
        <div className="space-y-3">
          {metricGroups.map((m, i) => (
            <div key={i}>
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-medium text-slate-600 capitalize">{m.metric_name}</p>
                {m.image_id && <p className="text-xs text-slate-400">image #{m.image_id}</p>}
              </div>
              <MetricBar value={m.avg_confidence} bar={d.bar} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ModelMetricsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['model-metrics'],
    queryFn: () => analyticsApi.modelMetrics(),
  })

  const rows = data?.results ?? data ?? []

  // API returns one aggregated row per domain: { maladie, model_id, avg_confidence, avg_latency_ms, sample_count }
  const summaries = rows.map((m) => ({
    maladie: m.maladie,
    summaryMetrics: [
      { metric_name: 'confiance IA', avg_confidence: m.avg_confidence },
    ],
    rawCount: m.sample_count ?? 0,
  }))

  // Add domains with no data
  const allDomains = ['pneumonie', 'melanome', 'tumeur']
  const presentMalades = new Set(rows.map((r) => r.maladie))
  allDomains.forEach((d) => {
    if (!presentMalades.has(d)) summaries.push({ maladie: d, summaryMetrics: [], rawCount: 0 })
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Métriques des modèles IA</h1>
        <p className="text-slate-500 text-sm">Performance des modèles HuggingFace par domaine médical.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : isError ? (
        <div className="py-20 text-center">
          <p className="text-red-600 text-sm">Erreur de chargement.</p>
        </div>
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {summaries.map(({ maladie, summaryMetrics }) => (
              <DomainCard key={maladie} maladie={maladie} metricGroups={summaryMetrics} />
            ))}
          </div>

          {/* Raw table */}
          {rows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-heading font-semibold text-slate-900 text-base">Détail des enregistrements</h2>
                <p className="text-xs text-slate-400 mt-0.5">{rows.length} entrée{rows.length !== 1 ? 's' : ''}</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Domaine</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Modèle</th>
                    <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Échantillons</th>
                    <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Latence moy.</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3 w-48">Confiance moy.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((m, i) => {
                    const d = DOMAIN_META[m.maladie] ?? {}
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${d.dot ?? 'bg-slate-400'}`} />
                            <span className="text-sm text-slate-700">{d.label ?? m.maladie}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400 font-mono truncate max-w-[180px]">{m.model_id ?? '—'}</td>
                        <td className="px-5 py-3 text-sm text-slate-600 text-right">{m.sample_count ?? '—'}</td>
                        <td className="px-5 py-3 text-sm text-slate-600 text-right">{m.avg_latency_ms != null ? `${m.avg_latency_ms} ms` : '—'}</td>
                        <td className="px-5 py-3">
                          <MetricBar value={m.avg_confidence} bar={d.bar ?? 'bg-primary'} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
