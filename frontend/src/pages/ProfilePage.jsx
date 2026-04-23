import { useQuery } from '@tanstack/react-query'
import { badgesApi } from '../api/badges'
import { resultsApi } from '../api/results'
import LoadingSpinner from '../components/LoadingSpinner'
import useAuthStore from '../store/authStore'
import { IconTrophy, IconLock, IconChart, IconFlame } from '../components/icons'

const ROLE_LABELS = { admin: 'Administrateur', prof: 'Professeur', etudiant: 'Étudiant' }

function StatItem({ label, value }) {
  return (
    <div className="text-center p-4">
      <p className="font-heading font-bold text-2xl text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

function BadgeCard({ badge, earned }) {
  return (
    <div className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border text-center transition-all ${
      earned
        ? 'bg-white border-slate-100 shadow-sm'
        : 'bg-slate-50 border-slate-100 opacity-55'
    }`}>
      {!earned && (
        <div className="absolute top-2.5 right-2.5">
          <IconLock className="w-3 h-3 text-slate-400" />
        </div>
      )}
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
        earned ? 'bg-primary/10' : 'bg-slate-100'
      }`}>
        {badge?.icone_svg
          ? <span dangerouslySetInnerHTML={{ __html: badge.icone_svg }} />
          : <IconTrophy className={`w-6 h-6 ${earned ? 'text-primary' : 'text-slate-300'}`} />
        }
      </div>
      <div>
        <p className={`text-xs font-semibold ${earned ? 'text-slate-800' : 'text-slate-400'}`}>
          {badge?.nom ?? 'Badge'}
        </p>
        {badge?.description && (
          <p className="text-xs text-slate-400 mt-0.5 leading-tight">{badge.description}</p>
        )}
      </div>
      {earned && (
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          Obtenu
        </span>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['results', 'me'],
    queryFn: resultsApi.me,
  })

  const { data: badges, isLoading: badgesLoading } = useQuery({
    queryKey: ['badges', 'me'],
    queryFn: badgesApi.me,
  })

  const earnedBadges = badges?.earned ?? []
  const availableBadges = badges?.available ?? []
  const allBadges = [
    ...earnedBadges.map((ub) => ({ badge: ub.badge ?? ub, earned: true })),
    ...availableBadges.map((b) => ({ badge: b, earned: false })),
  ]

  const initials = (
    user?.first_name?.[0] ?? user?.email?.[0] ?? 'U'
  ).toUpperCase()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="font-heading text-3xl font-bold text-slate-900 mb-6">Mon profil</h1>

      {/* Profile card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-r from-primary to-primary-dark" />

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="-mt-10 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-sm flex items-center justify-center bg-primary">
              <span className="font-heading font-bold text-white text-2xl">{initials}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="font-heading font-bold text-slate-900 text-xl">
                {user?.first_name
                  ? `${user.first_name} ${user.last_name ?? ''}`.trim()
                  : user?.email}
              </h2>
              <p className="text-slate-500 text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {ROLE_LABELS[user?.role] ?? 'Utilisateur'}
                </span>
                {user?.etablissement && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {user.etablissement}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100">
            {historyLoading ? (
              <div className="col-span-3 flex justify-center py-4"><LoadingSpinner /></div>
            ) : (
              <>
                <StatItem
                  label="Tentatives"
                  value={history?.count ?? 0}
                />
                <StatItem
                  label="Score moyen"
                  value={history?.average_score != null ? `${Math.round(history.average_score)}%` : '—'}
                />
                <StatItem
                  label="Badges obtenus"
                  value={earnedBadges.length}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Badges section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-heading font-semibold text-slate-900 text-lg">Badges</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {earnedBadges.length} obtenus · {availableBadges.length} à débloquer
            </p>
          </div>
          {earnedBadges.length > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <IconTrophy className="w-3.5 h-3.5" />
              {earnedBadges.length} badge{earnedBadges.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {badgesLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : allBadges.length === 0 ? (
          <div className="text-center py-10">
            <IconTrophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Commencez des exercices pour débloquer des badges.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allBadges.map(({ badge, earned }, i) => (
              <BadgeCard key={badge?.id ?? i} badge={badge} earned={earned} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
