import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../../api/analytics'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconUser, IconBook, IconChart, IconDatabase, IconCheck, IconX } from '../../components/icons'

const DOMAIN_META = {
  pneumonie: { label: 'Radiologie', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  melanome: { label: 'Dermatologie', dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  retinopathie: { label: 'Ophtalmologie', dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
}

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor, to }) {
  const inner = (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`${iconBg} rounded-xl p-2.5 shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
        <p className="font-heading text-2xl font-bold text-slate-900">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function ETLHealthBar({ total, success, error }) {
  const pct = total > 0 ? (success / total) * 100 : 0
  const color = pct >= 90 ? 'bg-primary' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-2">
        <span>{success} succès</span>
        <span>{error} erreurs</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-1.5">{Math.round(pct)}% de réussite sur {total} jobs</p>
    </div>
  )
}

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['analytics', 'admin'],
    queryFn: () => analyticsApi.adminDashboard(),
  })

  const etlHealth = dashboard?.etl_health ?? {}
  const modelMetrics = dashboard?.model_metrics ?? []
  const recentLogs = dashboard?.recent_etl_logs ?? []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-slate-400 capitalize mb-1">{today}</p>
        <h1 className="font-heading text-3xl font-bold text-slate-900">
          Administration 👨‍💻
        </h1>
        <p className="text-slate-500 text-sm mt-1">Vue globale de la plateforme MedTrain AI.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard to="/users" icon={IconUser} label="Utilisateurs" value={dashboard?.total_users ?? 0} sub={`${dashboard?.total_profs ?? 0} profs · ${dashboard?.total_students ?? 0} étudiants`} iconBg="bg-violet-100" iconColor="text-violet-600" />
            <StatCard icon={IconBook} label="Exercices" value={dashboard?.total_exercises ?? 0} sub="Sur la plateforme" iconBg="bg-primary/10" iconColor="text-primary" />
            <StatCard icon={IconChart} label="Tentatives" value={dashboard?.total_attempts ?? 0} sub="Toutes sessions" iconBg="bg-blue-100" iconColor="text-blue-600" />
            <StatCard
              icon={IconDatabase}
              label="Score moyen"
              value={dashboard?.avg_score != null ? `${Math.round(dashboard.avg_score)}%` : '—'}
              sub="Toutes tentatives"
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
            />
          </div>

          {/* Second row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* ETL Health */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-semibold text-slate-900 text-base">Santé ETL</h2>
                <Link to="/etl-logs" className="text-xs text-primary font-semibold hover:underline">Voir logs →</Link>
              </div>
              <ETLHealthBar
                total={etlHealth.total ?? 0}
                success={etlHealth.success ?? 0}
                error={etlHealth.error ?? 0}
              />
              <div className="mt-4 flex gap-3">
                <div className="flex-1 bg-primary-light rounded-xl p-3 text-center">
                  <p className="font-heading font-bold text-primary text-xl">{etlHealth.success ?? 0}</p>
                  <p className="text-xs text-slate-400">Succès</p>
                </div>
                <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
                  <p className="font-heading font-bold text-red-600 text-xl">{etlHealth.error ?? 0}</p>
                  <p className="text-xs text-slate-400">Erreurs</p>
                </div>
              </div>
            </div>

            {/* Model metrics */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-semibold text-slate-900 text-base">Modèles IA</h2>
                <Link to="/model-metrics" className="text-xs text-primary font-semibold hover:underline">Détail →</Link>
              </div>
              {modelMetrics.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune métrique disponible.</p>
              ) : (
                <div className="space-y-3">
                  {modelMetrics.map((m, i) => {
                    const d = DOMAIN_META[m.maladie] ?? {}
                    const score = m.metric_value != null ? m.metric_value * 100 : null
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${d.dot ?? 'bg-slate-400'}`} />
                            <p className="text-xs font-medium text-slate-700">{d.label ?? m.maladie}</p>
                          </div>
                          <p className="text-xs font-bold text-slate-700">{score != null ? `${Math.round(score)}%` : '—'}</p>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${score ?? 0}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* User breakdown */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-semibold text-slate-900 text-base">Utilisateurs</h2>
                <Link to="/users" className="text-xs text-primary font-semibold hover:underline">Gérer →</Link>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Administrateurs', count: dashboard?.total_admins ?? 0, color: 'bg-red-500' },
                  { label: 'Professeurs', count: dashboard?.total_profs ?? 0, color: 'bg-violet-500' },
                  { label: 'Étudiants', count: dashboard?.total_students ?? 0, color: 'bg-primary' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${row.color} shrink-0`} />
                    <p className="text-sm text-slate-600 flex-1">{row.label}</p>
                    <p className="font-heading font-bold text-slate-900 text-sm">{row.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent ETL logs */}
          {recentLogs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-heading font-semibold text-slate-900 text-base">Activité ETL récente</h2>
                <Link to="/etl-logs" className="text-xs text-primary font-semibold hover:underline">Voir tout →</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {recentLogs.slice(0, 5).map((log, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${log.status === 'success' ? 'bg-primary/10' : 'bg-red-50'}`}>
                      {log.status === 'success'
                        ? <IconCheck className="w-3.5 h-3.5 text-primary" />
                        : <IconX className="w-3.5 h-3.5 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{log.step ?? log.message ?? 'Job ETL'}</p>
                      <p className="text-xs text-slate-400">{log.maladie ?? '—'} · Dataset #{log.dataset_id ?? '?'}</p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {log.duration_ms != null ? `${log.duration_ms}ms` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
