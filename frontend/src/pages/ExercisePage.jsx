import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { exercisesApi } from '../api/exercises'
import { attemptsApi } from '../api/attempts'
import LoadingSpinner from '../components/LoadingSpinner'
import Button from '../components/Button'
import { IconArrowLeft, IconClock, IconPlay } from '../components/icons'

const DOMAIN_META = {
  pneumonie: { label: 'Radiologie · Pneumonie', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  melanome: { label: 'Dermatologie · Mélanome', color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  retinopathie: { label: 'Ophtalmologie · Rétinopathie', color: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500' },
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Step 0: Info screen ───────────────────────────────────────────────────

function InfoScreen({ exercise, onStart, loading }) {
  const domain = DOMAIN_META[exercise.maladie] ?? { label: exercise.maladie, color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' }
  const nb = exercise.exam_config?.nb_images ?? 10
  const isExam = exercise.exam_config?.est_examen

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center p-8">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm max-w-lg w-full p-8">
        <div className={`${domain.bg} w-12 h-12 rounded-2xl flex items-center justify-center mb-5`}>
          <div className={`w-4 h-4 rounded-full ${domain.dot}`} />
        </div>

        <p className={`text-sm font-semibold ${domain.color} uppercase tracking-wide mb-2`}>
          {domain.label}
        </p>
        <h1 className="font-heading text-2xl font-bold text-slate-900 mb-3">
          {exercise.titre ?? `Exercice #${exercise.id}`}
        </h1>
        {exercise.description && (
          <p className="text-slate-500 text-sm mb-5 leading-relaxed">{exercise.description}</p>
        )}

        <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Nombre d'images</span>
            <span className="font-semibold text-slate-800">{nb} images</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Difficulté</span>
            <span className="font-semibold text-slate-800 capitalize">{exercise.difficulte}</span>
          </div>
          {isExam && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Type</span>
              <span className="font-semibold text-slate-800">Examen noté</span>
            </div>
          )}
          {exercise.exam_config?.max_tentatives && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tentatives max.</span>
              <span className="font-semibold text-slate-800">{exercise.exam_config.max_tentatives}</span>
            </div>
          )}
        </div>

        <div className="bg-primary-light border border-primary/20 rounded-xl px-4 py-3 text-sm text-primary mb-6">
          Pour chaque image, indiquez si le patient est <strong>Positif</strong> (malade) ou <strong>Négatif</strong> (sain).
          L'IA analysera vos réponses et fournira un feedback détaillé.
        </div>

        <Button onClick={onStart} loading={loading} className="w-full" size="lg">
          <IconPlay className="w-4 h-4 mr-2" />
          Commencer l'exercice
        </Button>
      </div>
    </div>
  )
}

// ─── Step 1: Diagnosis ─────────────────────────────────────────────────────

function DiagnosisScreen({ session, onSubmit, submitting }) {
  const images = session.images ?? []
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const answered = Object.keys(answers).length
  const progress = images.length > 0 ? (answered / images.length) * 100 : 0
  const img = images[current]
  const currentAnswer = img ? answers[img.id] : null
  const allAnswered = answered === images.length

  function handleAnswer(value) {
    if (!img) return
    setAnswers((prev) => ({ ...prev, [img.id]: value }))
    // Auto-advance after short delay
    if (current < images.length - 1) {
      setTimeout(() => setCurrent((c) => c + 1), 300)
    }
  }

  function handleSubmit() {
    const payload = {
      exercise: session.exercise_id ?? parseInt(window.location.pathname.split('/')[2]),
      duree_reelle: elapsed,
      mode: 'practice',
      answers: images.map((i) => ({
        image_id: i.id,
        reponse_etudiant: answers[i.id] ?? 'sain',
      })),
    }
    onSubmit(payload)
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4">
        {/* Progress */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{answered} / {images.length} répondues</span>
            <span className="flex items-center gap-1">
              <IconClock className="w-3.5 h-3.5" />
              {formatTime(elapsed)}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {allAnswered && (
          <Button onClick={handleSubmit} loading={submitting} size="sm">
            Soumettre
          </Button>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Image nav dots */}
        <div className="flex gap-1.5 mb-5">
          {images.map((im, i) => (
            <button
              key={im.id}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${
                i === current
                  ? 'w-5 h-2 bg-primary'
                  : answers[im.id]
                  ? 'w-2 h-2 bg-primary/40'
                  : 'w-2 h-2 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Image card */}
        {img && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm max-w-lg w-full overflow-hidden">
            <div className="bg-slate-900 aspect-square max-h-72 flex items-center justify-center">
              <img
                src={img.url ?? img.chemin}
                alt={`Image médicale ${current + 1}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
              <div className="hidden w-full h-full items-center justify-center text-slate-500 text-sm">
                Image non disponible
              </div>
            </div>

            <div className="p-5">
              <p className="text-xs text-slate-400 text-center mb-4">
                Image {current + 1} sur {images.length}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAnswer('malade')}
                  className={`py-4 rounded-2xl text-sm font-semibold border-2 transition-all ${
                    currentAnswer === 'malade'
                      ? 'bg-red-500 border-red-500 text-white scale-[0.98]'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <span className="block text-lg mb-0.5">🔴</span>
                  Positif
                  <span className="block text-xs opacity-60 font-normal">Malade</span>
                </button>

                <button
                  onClick={() => handleAnswer('sain')}
                  className={`py-4 rounded-2xl text-sm font-semibold border-2 transition-all ${
                    currentAnswer === 'sain'
                      ? 'bg-primary border-primary text-white scale-[0.98]'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-primary/40 hover:bg-primary-light'
                  }`}
                >
                  <span className="block text-lg mb-0.5">🟢</span>
                  Négatif
                  <span className="block text-xs opacity-60 font-normal">Sain</span>
                </button>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={current === 0}
                  className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
                >
                  ← Précédente
                </button>
                <button
                  onClick={() => setCurrent((c) => Math.min(images.length - 1, c + 1))}
                  disabled={current === images.length - 1}
                  className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
                >
                  Suivante →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit bar (bottom) when all answered */}
      {allAnswered && (
        <div className="bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Toutes les images ont été diagnostiquées.
          </p>
          <Button onClick={handleSubmit} loading={submitting} size="lg">
            Valider mes réponses
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ExercisePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [phase, setPhase] = useState('info') // 'info' | 'session'
  const [session, setSession] = useState(null)

  const { data: exercise, isLoading } = useQuery({
    queryKey: ['exercise', id],
    queryFn: () => exercisesApi.get(id),
  })

  const startMutation = useMutation({
    mutationFn: () => exercisesApi.start(id),
    onSuccess: (data) => {
      // Inject exercise_id for use in DiagnosisScreen
      setSession({ ...data, exercise_id: parseInt(id) })
      setPhase('session')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (payload) => attemptsApi.submit(payload),
    onSuccess: (data) => {
      navigate(`/exercises/${id}/feedback/${data.id}`)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-slate-500">Exercice introuvable.</p>
        <Link to="/exercises" className="text-sm text-primary hover:underline">← Retour aux exercices</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Back link */}
      <div className="absolute top-4 left-72 z-10">
        <Link
          to="/exercises"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <IconArrowLeft className="w-4 h-4" />
          Exercices
        </Link>
      </div>

      {phase === 'info' && (
        <InfoScreen
          exercise={exercise}
          onStart={() => startMutation.mutate()}
          loading={startMutation.isPending}
        />
      )}

      {phase === 'session' && session && (
        <DiagnosisScreen
          session={session}
          onSubmit={submitMutation.mutate}
          submitting={submitMutation.isPending}
        />
      )}

      {startMutation.isError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
          Impossible de démarrer la session. Réessayez.
        </div>
      )}
    </div>
  )
}
