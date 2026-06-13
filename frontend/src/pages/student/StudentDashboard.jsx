import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { resultsApi }   from '../../api/results'
import { badgesApi }    from '../../api/badges'
import { exercisesApi } from '../../api/exercises'
import LoadingSpinner   from '../../components/LoadingSpinner'
import useAuthStore     from '../../store/authStore'
import { DOMAIN_META, DIFFICULTY_COLORS, BADGE_COLORS } from '../../styles/theme'
import {
  IconFlame, IconTrophy, IconChart, IconBook,
  IconLock, IconChevronRight, IconPlay, IconStar,
} from '../../components/icons'

// ─── Stat card ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-start gap-4 shadow-sm card-hover">
      <div className={`${iconBg} rounded-xl p-2.5 shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 mb-0.5 truncate">{label}</p>
        <p className="font-heading text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'bg-primary' }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
      <div
        className={`${color} rounded-full h-1.5 transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
      />
    </div>
  )
}

// ─── Badge chip ───────────────────────────────────────────────────────────

function BadgeItem({ item, earned }) {
  const badge = earned ? (item.badge ?? item) : item
  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${
        earned
          ? 'bg-white border-slate-100 shadow-sm'
          : 'bg-slate-50 border-slate-100 opacity-50'
      }`}
    >
      {!earned && <IconLock className="w-3 h-3 text-slate-300 self-end -mb-1" />}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${earned ? 'bg-primary-light' : 'bg-slate-100'}`}>
        {badge?.icone_svg
          ? <span dangerouslySetInnerHTML={{ __html: badge.icone_svg }} />
          : <IconTrophy className={`w-4 h-4 ${earned ? 'text-primary-dark' : 'text-slate-300'}`} />
        }
      </div>
      <p className={`text-[11px] font-semibold leading-tight ${earned ? 'text-slate-700' : 'text-slate-400'}`}>
        {badge?.nom ?? 'Badge'}
      </p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const user      = useAuthStore((s) => s.user)
  const firstName = user?.first_name ?? user?.email?.split('@')[0] ?? 'là'
  const today     = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const { data: history }       = useQuery({ queryKey: ['results', 'me'],    queryFn: resultsApi.me })
  const { data: badges }        = useQuery({ queryKey: ['badges', 'me'],     queryFn: badgesApi.me })
  const { data: exercisesData } = useQuery({ queryKey: ['exercises'],        queryFn: () => exercisesApi.list() })

  const exercises      = exercisesData?.results ?? exercisesData ?? []
  const practiceExs    = exercises.filter((e) => !e.exam_config?.est_examen)
  const upcomingExams  = exercises.filter((e) =>  e.exam_config?.est_examen)
  const earnedBadges   = badges?.earned   ?? []
  const availableBadges = badges?.available ?? []
  const displayBadges  = [...earnedBadges, ...availableBadges].slice(0, 6)

  const avgRaw        = history?.average_score ?? null
  const avgScore      = avgRaw != null ? (avgRaw <= 1 ? Math.round(avgRaw * 100) : Math.round(avgRaw)) : null
  const totalAttempts = history?.count ?? 0
  const streak        = history?.streak ?? 0

  return (
    <div className="p-8 max-w-6xl mx-auto animate-page">

      {/* ── Header ── */}
      <div className="mb-8">
        <p className="text-sm text-slate-400 capitalize mb-1">{today}</p>
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl font-bold text-slate-900">
            Bonjour, {firstName}&nbsp;👋
          </h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">Continuez votre entraînement médical.</p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger">
        <StatCard
          icon={IconChart} label="Score moyen"
          value={avgScore != null ? `${avgScore}%` : '—'}
          sub={`${totalAttempts} tentative${totalAttempts !== 1 ? 's' : ''}`}
          iconBg="bg-primary-light" iconColor="text-primary-dark"
        />
        <StatCard
          icon={IconBook} label="Exercices faits"
          value={totalAttempts} sub="Sessions complétées"
          iconBg="bg-violet-100" iconColor="text-violet-600"
        />
        <StatCard
          icon={IconFlame} label="Série"
          value={streak > 0 ? `${streak}j` : '—'}
          sub={streak > 0 ? 'Jours consécutifs' : "Commencez aujourd'hui"}
          iconBg="bg-orange-100" iconColor="text-orange-500"
        />
        <StatCard
          icon={IconTrophy} label="Badges"
          value={earnedBadges.length}
          sub={availableBadges.length > 0 ? `${availableBadges.length} à débloquer` : 'Tous obtenus !'}
          iconBg="bg-amber-100" iconColor="text-amber-600"
        />
      </div>

      {/* ── Exam banner ── */}
      {upcomingExams.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-primary-dark to-primary rounded-2xl p-5 flex items-center justify-between gap-4 shadow-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <IconStar className="w-4 h-4 text-mint" />
              <p className="text-mint text-xs font-semibold uppercase tracking-widest">Examen à venir</p>
            </div>
            <p className="font-heading font-bold text-white text-lg">
              {upcomingExams[0].titre ?? `Examen — ${DOMAIN_META[upcomingExams[0].maladie]?.label ?? upcomingExams[0].maladie ?? 'À venir'}`}
            </p>
            {upcomingExams[0].exam_config?.deadline && (
              <p className="text-white/60 text-sm mt-0.5">
                Avant le{' '}
                {new Date(upcomingExams[0].exam_config.deadline).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            )}
          </div>
          <Link
            to={`/exercises/${upcomingExams[0].id}`}
            className="flex items-center gap-2 bg-white text-primary-dark px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shrink-0 shadow-sm"
          >
            <IconPlay className="w-4 h-4" />
            Commencer
          </Link>
        </div>
      )}

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Exercise list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-heading font-semibold text-slate-900 text-base">Exercices disponibles</h2>
            <Link to="/exercises" className="text-xs text-primary-dark font-semibold hover:underline flex items-center gap-1">
              Voir tout <IconChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-50">
            {practiceExs.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <IconBook className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">Aucun exercice disponible.</p>
              </div>
            ) : (
              practiceExs.slice(0, 5).map((ex, i) => {
                const domain  = DOMAIN_META[ex.maladie] ?? { bg: 'bg-slate-100', dot: 'bg-slate-400', text: 'text-slate-600' }
                const attempt = history?.results?.find((r) => r.exercise?.id === ex.id)
                const diff    = DIFFICULTY_COLORS[ex.difficulte]

                return (
                  <Link
                    key={ex.id}
                    to={`/exercises/${ex.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-xl ${domain.bg} flex items-center justify-center shrink-0`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${domain.dot}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {ex.titre ?? `Exercice ${i + 1}`}
                        </p>
                        {diff && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${diff}`}>
                            {ex.difficulte}
                          </span>
                        )}
                      </div>
                      <ProgressBar value={(attempt?.score ?? 0) * 100} />
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-slate-500">
                        {attempt ? `${Math.round((attempt.score ?? 0) * 100)}%` : '—'}
                      </span>
                    </div>

                    <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <IconTrophy className="w-4 h-4 text-amber-500" />
              <h2 className="font-heading font-semibold text-slate-900 text-base">Badges</h2>
            </div>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {earnedBadges.length}/{earnedBadges.length + availableBadges.length}
            </span>
          </div>

          <div className="p-4">
            {displayBadges.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <IconTrophy className="w-6 h-6 text-amber-300" />
                </div>
                <p className="text-xs text-slate-400">Les badges apparaîtront ici.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {displayBadges.map((item, i) => (
                  <BadgeItem
                    key={item?.id ?? i}
                    item={item}
                    earned={i < earnedBadges.length}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
