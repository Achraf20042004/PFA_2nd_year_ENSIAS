import { useQuery }    from '@tanstack/react-query'
import { Link }        from 'react-router-dom'
import { analyticsApi } from '../../api/analytics'
import { badgesApi }    from '../../api/badges'
import useAuthStore     from '../../store/authStore'
import LoadingSpinner   from '../../components/LoadingSpinner'
import { DOMAIN_META, BADGE_COLORS } from '../../styles/theme'
import { IconBook, IconChart, IconUser, IconChevronRight, IconTrophy } from '../../components/icons'

const RANK_COLORS = ['text-amber-500', 'text-slate-400', 'text-orange-400']

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-sm card-hover">
      <div className={`${iconBg} rounded-xl p-2.5 shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
        <p className="font-heading text-2xl font-bold text-slate-900">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-xs text-slate-300">—</span>
  const color = score >= 80 ? 'bg-primary-light text-primary-dark' : score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${color}`}>
      {Math.round(score)}%
    </span>
  )
}

export default function ProfDashboard() {
  const user      = useAuthStore((s) => s.user)
  const firstName = user?.first_name ?? user?.email?.split('@')[0] ?? 'Professeur'
  const today     = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['analytics', 'prof'],
    queryFn:  () => analyticsApi.profDashboard(),
  })

  const { data: studentsRaw, isLoading: studentsLoading } = useQuery({
    queryKey: ['badges', 'students'],
    queryFn:  badgesApi.students,
  })

  const exercises      = dashboard?.exercises      ?? []
  const totalStudents  = dashboard?.total_students  ?? 0
  const totalAttempts  = dashboard?.total_attempts  ?? 0
  const avgScore       = dashboard?.avg_score       ?? null
  const activeExercises = exercises.filter((e) => e.actif !== false).length

  const leaderboard = [...(studentsRaw ?? [])].sort((a, b) => {
    const sumA = (a.domains ?? []).reduce((s, d) => s + (d.score ?? 0), 0)
    const sumB = (b.domains ?? []).reduce((s, d) => s + (d.score ?? 0), 0)
    return sumB - sumA
  })

  return (
    <div className="p-8 max-w-6xl mx-auto animate-page">

      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-slate-400 capitalize mb-1">{today}</p>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Bonjour, {firstName}&nbsp;👋</h1>
        <p className="text-slate-500 text-sm mt-1">Vue d'ensemble de vos exercices.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
            <StatCard icon={IconBook}  label="Exercices actifs"   value={activeExercises}  sub={`${exercises.length} au total`}        iconBg="bg-primary-light"  iconColor="text-primary-dark" />
            <StatCard icon={IconUser}  label="Étudiants actifs"   value={totalStudents}    sub="Ont tenté ≥1 exercice"                 iconBg="bg-violet-100"     iconColor="text-violet-600" />
            <StatCard icon={IconChart} label="Tentatives totales" value={totalAttempts}    sub="Toutes sessions"                       iconBg="bg-blue-100"       iconColor="text-blue-600" />
            <StatCard
              icon={IconChart}
              label="Score moyen"
              value={avgScore != null ? `${Math.round(avgScore)}%` : '—'}
              sub="Tous exercices"
              iconBg="bg-amber-100" iconColor="text-amber-600"
            />
          </div>

          {/* Exercises table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-heading font-semibold text-slate-900 text-base">Mes exercices</h2>
              <Link to="/my-exercises" className="text-xs text-primary-dark font-semibold hover:underline flex items-center gap-1">
                Gérer <IconChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {exercises.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <IconBook className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">Aucun exercice créé.</p>
                <Link to="/my-exercises" className="mt-3 inline-block text-sm text-primary-dark font-semibold hover:underline">
                  Créer un exercice →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Exercice</th>
                      <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Domaine</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Étudiants</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Tentatives</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Score moy.</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {exercises.map((ex, i) => {
                      const d = DOMAIN_META[ex.maladie] ?? {
                        label: ex.maladie, dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-700',
                      }
                      return (
                        <tr key={ex.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-slate-800">{ex.titre ?? `Exercice ${i + 1}`}</p>
                            <p className="text-xs text-slate-400 capitalize mt-0.5">{ex.difficulte}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${d.bg} ${d.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
                              {d.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm text-slate-700 font-semibold">{ex.nb_students ?? 0}</td>
                          <td className="px-5 py-3.5 text-right text-sm text-slate-700 font-semibold">{ex.nb_attempts ?? 0}</td>
                          <td className="px-5 py-3.5 text-right"><ScoreBadge score={ex.avg_score} /></td>
                          <td className="px-5 py-3.5">
                            <Link to={`/exercises/${ex.id}`} className="text-slate-300 hover:text-primary-dark transition-colors group-hover:opacity-100">
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

          {/* Student leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                  <IconTrophy className="w-4 h-4 text-amber-600" />
                </div>
                <h2 className="font-heading font-semibold text-slate-900 text-base">Classement étudiants</h2>
              </div>
              {!studentsLoading && (
                <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
                  {leaderboard.length} étudiant{leaderboard.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {studentsLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <IconUser className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">Aucun étudiant inscrit pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3 w-10">#</th>
                      <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Étudiant</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Pneumonie</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Dermatologie</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Neurologie</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Total</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Connexion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {leaderboard.map((student, idx) => {
                      const domainMap = Object.fromEntries((student.domains ?? []).map((d) => [d.domain, d]))
                      const total     = (student.domains ?? []).reduce((s, d) => s + (d.score ?? 0), 0)
                      const rankColor = RANK_COLORS[idx] ?? 'text-slate-400'

                      return (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className={`text-sm font-bold ${rankColor}`}>#{idx + 1}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
                                <span className="text-primary-dark text-xs font-bold">
                                  {(student.first_name?.[0] ?? student.email?.[0] ?? 'U').toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {student.first_name
                                    ? `${student.first_name} ${student.last_name ?? ''}`.trim()
                                    : student.email}
                                </p>
                                <p className="text-xs text-slate-400">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          {['radiologie', 'dermatologie', 'neurologie'].map((domain) => {
                            const entry = domainMap[domain]
                            return (
                              <td key={domain} className="px-5 py-3.5 text-right">
                                {entry ? (
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{entry.score} <span className="text-slate-400 font-normal text-xs">pts</span></p>
                                    {entry.badge && (
                                      <p className={`text-[11px] font-semibold ${BADGE_COLORS[entry.badge] ? '' : 'text-slate-400'}`}>
                                        <span className={`px-1.5 py-0.5 rounded-full ${BADGE_COLORS[entry.badge] ?? 'bg-slate-100 text-slate-400'}`}>
                                          {entry.badge}
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs">—</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-5 py-3.5 text-right">
                            <span className="text-sm font-bold text-primary-dark">{total} pts</span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                            {student.last_login
                              ? new Date(student.last_login).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—'}
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
