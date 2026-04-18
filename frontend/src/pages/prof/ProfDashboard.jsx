import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../../api/analytics'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconBook, IconChart, IconUser, IconChevronRight, IconPlay } from '../../components/icons'

const DOMAIN_META = {
  pneumonie: { label: 'Radiologie', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  melanome: { label: 'Dermatologie', dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  retinopathie: { label: 'Ophtalmologie', dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
}

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-sm">
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
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-xs text-slate-400">—</span>
  const color = score >= 80 ? 'bg-primary/10 text-primary' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`text-xs font-bold px-2 py-1 rounded-lg ${color}`}>{Math.round(score)}%</span>
}

export default function ProfDashboard() {
  const user = useAuthStore((s) => s.user)
  const firstName = user?.first_name ?? user?.email?.split('@')[0] ?? 'Professeur'
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['analytics', 'prof'],
    queryFn: () => analyticsApi.profDashboard(),
  })

  const exercises = dashboard?.exercises ?? []
  const totalStudents = dashboard?.total_students ?? 0
  const totalAttempts = dashboard?.total_attempts ?? 0
  const avgScore = dashboard?.avg_score ?? null
  const activeExercises = exercises.filter((e) => e.actif !== false).length

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-slate-400 capitalize mb-1">{today}</p>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Bonjour, {firstName} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Vue d'ensemble de vos exercices.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={IconBook} label="Exercices actifs" value={activeExercises} sub={`${exercises.length} au total`} iconBg="bg-primary/10" iconColor="text-primary" />
            <StatCard icon={IconUser} label="Étudiants actifs" value={totalStudents} sub="Ont tenté ≥1 exercice" iconBg="bg-violet-100" iconColor="text-violet-600" />
            <StatCard icon={IconChart} label="Tentatives totales" value={totalAttempts} sub="Toutes sessions" iconBg="bg-blue-100" iconColor="text-blue-600" />
            <StatCard
              icon={IconChart}
              label="Score moyen"
              value={avgScore != null ? `${Math.round(avgScore)}%` : '—'}
              sub="Tous exercices"
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
            />
          </div>

          {/* Exercises table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-heading font-semibold text-slate-900 text-base">Mes exercices</h2>
              <Link to="/my-exercises" className="text-xs text-primary font-semibold hover:underline">
                Gérer →
              </Link>
            </div>

            {exercises.length === 0 ? (
              <div className="py-16 text-center">
                <IconBook className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Aucun exercice créé.</p>
                <Link to="/my-exercises" className="mt-3 inline-block text-sm text-primary font-medium hover:underline">
                  Créer un exercice →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Exercice</th>
                      <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Domaine</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Étudiants</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Tentatives</th>
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Score moy.</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {exercises.map((ex) => {
                      const d = DOMAIN_META[ex.maladie] ?? { label: ex.maladie, dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-700' }
                      return (
                        <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-medium text-slate-800">{ex.titre ?? `Exercice #${ex.id}`}</p>
                            <p className="text-xs text-slate-400 capitalize">{ex.difficulte}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${d.bg} ${d.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
                              {d.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm text-slate-700 font-medium">{ex.nb_students ?? 0}</td>
                          <td className="px-5 py-3.5 text-right text-sm text-slate-700 font-medium">{ex.nb_attempts ?? 0}</td>
                          <td className="px-5 py-3.5 text-right"><ScoreBadge score={ex.avg_score} /></td>
                          <td className="px-5 py-3.5">
                            <Link to={`/exercises/${ex.id}`} className="text-slate-400 hover:text-primary transition-colors">
                              <IconChevronRight className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
