import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { exercisesApi } from '../../api/exercises'
import { resultsApi } from '../../api/results'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconPlay, IconClock, IconCheck, IconLock } from '../../components/icons'

const DOMAIN_META = {
  pneumonie: { label: 'Radiologie', bg: 'bg-blue-50', dot: 'bg-blue-500', text: 'text-blue-700' },
  melanome: { label: 'Dermatologie', bg: 'bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-700' },
  retinopathie: { label: 'Ophtalmologie', bg: 'bg-violet-50', dot: 'bg-violet-500', text: 'text-violet-700' },
}

function countdown(deadline) {
  if (!deadline) return null
  const diff = new Date(deadline) - new Date()
  if (diff <= 0) return { label: 'Expiré', expired: true }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return { label: `${days}j ${hours}h restants`, expired: false }
  return { label: `${hours}h restantes`, expired: false, urgent: hours < 6 }
}

function ExamCard({ exercise, attempts }) {
  const domain = DOMAIN_META[exercise.maladie] ?? { label: exercise.maladie, bg: 'bg-slate-50', dot: 'bg-slate-400', text: 'text-slate-700' }
  const cfg = exercise.exam_config ?? {}
  const timer = countdown(cfg.deadline)
  const usedAttempts = attempts?.length ?? 0
  const maxAttempts = cfg.max_tentatives
  const attemptsLeft = maxAttempts != null ? maxAttempts - usedAttempts : null
  const isLocked = attemptsLeft != null && attemptsLeft <= 0
  const bestScore = attempts?.length > 0 ? Math.max(...attempts.map((a) => a.score ?? 0)) : null

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isLocked ? 'border-slate-100 opacity-70' : 'border-slate-100 hover:border-primary/30 hover:shadow-md'}`}>
      {/* Header band */}
      <div className={`px-5 py-3 ${domain.bg} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${domain.dot}`} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${domain.text}`}>{domain.label}</span>
        </div>
        {timer && (
          <span className={`text-xs font-medium flex items-center gap-1 ${timer.expired ? 'text-red-600' : timer.urgent ? 'text-orange-600' : 'text-slate-500'}`}>
            <IconClock className="w-3.5 h-3.5" />
            {timer.label}
          </span>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-heading font-semibold text-slate-900 text-base mb-3">
          {exercise.titre ?? `Examen #${exercise.id}`}
        </h3>

        {/* Meta grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="font-heading font-bold text-slate-900 text-lg">{cfg.nb_images ?? 10}</p>
            <p className="text-xs text-slate-400 mt-0.5">Images</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="font-heading font-bold text-slate-900 text-lg">{cfg.duree_minutes ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-0.5">Minutes</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className={`font-heading font-bold text-lg ${attemptsLeft === 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {attemptsLeft != null ? attemptsLeft : '∞'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Essais rest.</p>
          </div>
        </div>

        {/* Best score */}
        {bestScore != null && (
          <div className="flex items-center gap-2 mb-4 bg-primary-light rounded-xl px-3 py-2">
            <IconCheck className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm text-primary font-medium">
              Meilleur score : <strong>{Math.round(bestScore)}%</strong>
            </p>
          </div>
        )}

        {/* CTA */}
        {isLocked || timer?.expired ? (
          <div className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-100 rounded-xl text-sm text-slate-400 font-medium">
            <IconLock className="w-4 h-4" />
            {timer?.expired ? 'Délai expiré' : 'Tentatives épuisées'}
          </div>
        ) : (
          <Link
            to={`/exercises/${exercise.id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            <IconPlay className="w-4 h-4" />
            {usedAttempts > 0 ? 'Recommencer' : 'Démarrer l\'examen'}
          </Link>
        )}
      </div>
    </div>
  )
}

export default function ExamsPage() {
  const { data: exercisesData, isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exercisesApi.list(),
  })

  const { data: history } = useQuery({
    queryKey: ['results', 'me'],
    queryFn: resultsApi.me,
  })

  const exercises = exercisesData?.results ?? exercisesData ?? []
  const exams = exercises.filter((e) => e.exam_config?.est_examen)
  const attempts = history?.results ?? []

  // Group attempts by exercise id
  const attemptsByExercise = {}
  attempts.forEach((a) => {
    const eid = a.exercise?.id ?? a.exercise
    if (!attemptsByExercise[eid]) attemptsByExercise[eid] = []
    attemptsByExercise[eid].push(a)
  })

  const upcoming = exams.filter((e) => {
    const d = e.exam_config?.deadline
    return !d || new Date(d) > new Date()
  })
  const expired = exams.filter((e) => {
    const d = e.exam_config?.deadline
    return d && new Date(d) <= new Date()
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Examens</h1>
        <p className="text-slate-500 text-sm">{exams.length} examen{exams.length !== 1 ? 's' : ''} au total</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      )}

      {!isLoading && exams.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <p className="text-slate-400 text-sm">Aucun examen programmé pour le moment.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="font-heading font-semibold text-slate-800 text-lg mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            À venir
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((ex) => (
              <ExamCard key={ex.id} exercise={ex} attempts={attemptsByExercise[ex.id]} />
            ))}
          </div>
        </section>
      )}

      {expired.length > 0 && (
        <section>
          <h2 className="font-heading font-semibold text-slate-500 text-lg mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
            Expirés
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
            {expired.map((ex) => (
              <ExamCard key={ex.id} exercise={ex} attempts={attemptsByExercise[ex.id]} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
