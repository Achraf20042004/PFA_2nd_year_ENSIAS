import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { resultsApi } from '../../api/results'
import { badgesApi } from '../../api/badges'
import { exercisesApi } from '../../api/exercises'
import LoadingSpinner from '../../components/LoadingSpinner'
import useAuthStore from '../../store/authStore'
import { IconFlame, IconTrophy, IconChart, IconBook, IconLock, IconChevronRight, IconPlay, IconStar } from '../../components/icons'

const DOMAIN_COLORS = {
  pneumonie: { bg: 'bg-blue-50', dot: 'bg-blue-500', text: 'text-blue-600' },
  melanome: { bg: 'bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-600' },
  retinopathie: { bg: 'bg-violet-50', dot: 'bg-violet-500', text: 'text-violet-600' },
}

const DIFFICULTY_COLORS = {
  facile: 'bg-emerald-100 text-emerald-700',
  moyen: 'bg-amber-100 text-amber-700',
  difficile: 'bg-red-100 text-red-700',
}

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-sm">
      <div className={`${iconBg} rounded-xl p-2.5 shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
        <p className="font-heading text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function ProgressBar({ value }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
    </div>
  )
}

export default function StudentDashboard() {
  const user = useAuthStore((s) => s.user)
  const firstName = user?.first_name ?? user?.email?.split('@')[0] ?? 'là'
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const { data: history } = useQuery({ queryKey: ['results', 'me'], queryFn: resultsApi.me })
  const { data: badges } = useQuery({ queryKey: ['badges', 'me'], queryFn: badgesApi.me })
  const { data: exercisesData } = useQuery({ queryKey: ['exercises'], queryFn: () => exercisesApi.list() })

  const exercises = exercisesData?.results ?? exercisesData ?? []
  const practicExercises = exercises.filter((e) => !e.exam_config?.est_examen)
  const upcomingExams = exercises.filter((e) => e.exam_config?.est_examen)
  const earnedBadges = badges?.earned ?? []
  const availableBadges = badges?.available ?? []
  const displayBadges = [...earnedBadges, ...availableBadges].slice(0, 6)
  const avgScore = history?.average_score ?? null
  const totalAttempts = history?.count ?? 0
  const streak = history?.streak ?? 0

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-slate-400 capitalize mb-1">{today}</p>
        <h1 className="font-heading text-3xl font-bold text-slate-900">Bonjour, {firstName} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Continuez votre entraînement.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={IconChart} label="Score moyen" value={avgScore != null ? `${Math.round(avgScore)}%` : '—'} sub={`${totalAttempts} tentative${totalAttempts !== 1 ? 's' : ''}`} iconBg="bg-primary/10" iconColor="text-primary" />
        <StatCard icon={IconBook} label="Exercices faits" value={totalAttempts} sub="Sessions complétées" iconBg="bg-violet-100" iconColor="text-violet-600" />
        <StatCard icon={IconFlame} label="Série" value={streak > 0 ? `${streak}j` : '—'} sub={streak > 0 ? 'Jours consécutifs' : 'Commencez aujourd\'hui'} iconBg="bg-orange-100" iconColor="text-orange-500" />
        <StatCard icon={IconTrophy} label="Badges" value={earnedBadges.length} sub={`/${displayBadges.length} disponibles`} iconBg="bg-amber-100" iconColor="text-amber-600" />
      </div>

      {/* Exam banner */}
      {upcomingExams.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <IconStar className="w-4 h-4 text-white/70" />
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Examen à venir</p>
            </div>
            <p className="font-heading font-bold text-white text-lg">{upcomingExams[0].titre ?? `Examen #${upcomingExams[0].id}`}</p>
            {upcomingExams[0].exam_config?.deadline && (
              <p className="text-white/70 text-sm mt-1">
                Avant le {new Date(upcomingExams[0].exam_config.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <Link
            to={`/exercises/${upcomingExams[0].id}`}
            className="flex items-center gap-2 bg-white text-primary px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shrink-0 shadow-sm"
          >
            <IconPlay className="w-4 h-4" />
            Commencer
          </Link>
        </div>
      )}

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent exercises */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-900 text-base">Exercices disponibles</h2>
            <Link to="/exercises" className="text-xs text-primary font-semibold hover:underline">Voir tout →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {practicExercises.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <IconBook className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Aucun exercice disponible.</p>
              </div>
            ) : (
              practicExercises.slice(0, 5).map((ex) => {
                const domain = DOMAIN_COLORS[ex.maladie] ?? { bg: 'bg-slate-100', dot: 'bg-slate-400', text: 'text-slate-600' }
                const attempt = history?.results?.find((r) => r.exercise === ex.id || r.exercise?.id === ex.id)
                return (
                  <Link key={ex.id} to={`/exercises/${ex.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                    <div className={`w-8 h-8 rounded-xl ${domain.bg} flex items-center justify-center shrink-0`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${domain.dot}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{ex.titre ?? `Exercice #${ex.id}`}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${DIFFICULTY_COLORS[ex.difficulte] ?? 'bg-slate-100 text-slate-500'}`}>{ex.difficulte}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={attempt?.score ?? 0} />
                        <span className="text-xs text-slate-400 w-9 text-right shrink-0">{attempt ? `${Math.round(attempt.score)}%` : '—'}</span>
                      </div>
                    </div>
                    <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-900 text-base">Badges</h2>
            <span className="text-xs text-slate-400">{earnedBadges.length}/{displayBadges.length}</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-2">
            {displayBadges.length === 0 ? (
              <div className="col-span-3 py-8 text-center">
                <IconTrophy className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Les badges apparaîtront ici.</p>
              </div>
            ) : (
              displayBadges.map((item, i) => {
                const earned = i < earnedBadges.length
                const badge = earned ? (item.badge ?? item) : item
                return (
                  <div key={item.id ?? i} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center ${earned ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-100 opacity-55'}`}>
                    {!earned && <IconLock className="w-3 h-3 text-slate-400 self-end -mb-1" />}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${earned ? 'bg-primary/10' : 'bg-slate-100'}`}>
                      {badge?.icone_svg
                        ? <span dangerouslySetInnerHTML={{ __html: badge.icone_svg }} />
                        : <IconTrophy className={`w-4 h-4 ${earned ? 'text-primary' : 'text-slate-300'}`} />
                      }
                    </div>
                    <p className={`text-xs font-medium leading-tight ${earned ? 'text-slate-700' : 'text-slate-400'}`}>{badge?.nom ?? 'Badge'}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
