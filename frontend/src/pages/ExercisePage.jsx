import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { exercisesApi } from '../api/exercises'
import { attemptsApi } from '../api/attempts'
import LoadingSpinner from '../components/LoadingSpinner'
import Button from '../components/Button'
import { IconArrowLeft, IconClock, IconPlay, IconCheck, IconX } from '../components/icons'

const DOMAIN_META = {
  pneumonie:    { label: 'Radiologie · Pneumonie',          color: 'text-blue-600',   bg: 'bg-blue-50',   dot: 'bg-blue-500'   },
  melanome:     { label: 'Dermatologie · Mélanome',         color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  retinopathie: { label: 'Ophtalmologie · Rétinopathie',   color: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500' },
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Phase 0: Info ──────────────────────────────────────────────────────────

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
          Vous recevrez un feedback détaillé après chaque réponse.
        </div>

        <Button onClick={onStart} loading={loading} className="w-full" size="lg">
          <IconPlay className="w-4 h-4 mr-2" />
          Commencer l'exercice
        </Button>
      </div>
    </div>
  )
}

// ─── Phase 1: Diagnosis ─────────────────────────────────────────────────────

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
    if (current < images.length - 1) {
      setTimeout(() => setCurrent((c) => c + 1), 280)
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

        {img && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm max-w-lg w-full overflow-hidden">
            <div className="bg-slate-900 aspect-square max-h-72 flex items-center justify-center relative">
              <img
                src={img.url ?? img.chemin}
                alt={`Image médicale ${current + 1}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
              <div className="hidden w-full h-full items-center justify-center text-slate-500 text-sm absolute inset-0">
                Image non disponible
              </div>
              <div className="absolute top-3 left-3 bg-black/40 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                {current + 1} / {images.length}
              </div>
            </div>

            <div className="p-5">
              <p className="text-xs font-medium text-slate-400 text-center mb-4 uppercase tracking-wide">
                Votre diagnostic
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAnswer('malade')}
                  className={`py-5 rounded-2xl text-sm font-semibold border-2 transition-all ${
                    currentAnswer === 'malade'
                      ? 'bg-red-500 border-red-500 text-white scale-[0.97] shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <span className="block text-2xl mb-1">🔴</span>
                  Positif
                  <span className="block text-xs opacity-60 font-normal mt-0.5">Malade</span>
                </button>

                <button
                  onClick={() => handleAnswer('sain')}
                  className={`py-5 rounded-2xl text-sm font-semibold border-2 transition-all ${
                    currentAnswer === 'sain'
                      ? 'bg-primary border-primary text-white scale-[0.97] shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-primary/40 hover:bg-primary-light'
                  }`}
                >
                  <span className="block text-2xl mb-1">🟢</span>
                  Négatif
                  <span className="block text-xs opacity-60 font-normal mt-0.5">Sain</span>
                </button>
              </div>

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

      {allAnswered && (
        <div className="bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">Toutes les images ont été diagnostiquées.</p>
          <Button onClick={handleSubmit} loading={submitting} size="lg">
            Valider mes réponses
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Phase 2: Per-image review ──────────────────────────────────────────────

function ConfidenceBar({ value }) {
  const color = value >= 70 ? 'bg-primary' : value >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>Confiance IA</span>
        <span className="font-semibold text-slate-700">{value}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function ReviewScreen({ attemptId, onFinish }) {
  const { data: feedback, isLoading } = useQuery({
    queryKey: ['feedback', attemptId],
    queryFn: () => attemptsApi.feedback(attemptId),
    staleTime: Infinity,
  })

  const [current, setCurrent] = useState(0)

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-slate-400">Analyse de vos réponses en cours…</p>
      </div>
    )
  }

  const results = feedback?.image_results ?? []
  if (results.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400 text-sm">Aucun résultat disponible.</p>
      </div>
    )
  }

  const result = results[current]
  const isLast = current === results.length - 1
  const confidence = result?.ml_confidence != null ? Math.round(result.ml_confidence * 100) : null
  const correct = result?.correct

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Progress bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Feedback · image {current + 1} sur {results.length}</span>
            <span>
              {results.slice(0, current + 1).filter(r => r.correct).length} correcte{results.slice(0, current + 1).filter(r => r.correct).length !== 1 ? 's' : ''} jusqu'ici
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((current + 1) / results.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className={`bg-white rounded-3xl shadow-sm max-w-lg w-full overflow-hidden border-2 transition-colors ${correct ? 'border-emerald-200' : 'border-red-200'}`}>
          {/* Medical image */}
          <div className="bg-slate-900 aspect-square max-h-72 flex items-center justify-center relative">
            {(result?.url ?? result?.chemin) ? (
              <img
                src={result.url ?? result.chemin}
                alt={`Image ${current + 1}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-slate-500 text-sm">Image non disponible</p>
            )}
            <div className="absolute top-3 left-3 bg-black/40 text-white text-xs px-2.5 py-1 rounded-full font-medium">
              {current + 1} / {results.length}
            </div>
          </div>

          {/* Verdict banner */}
          <div className={`px-5 py-4 flex items-center gap-4 ${correct ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${correct ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {correct
                ? <IconCheck className="w-6 h-6 text-white" />
                : <IconX className="w-6 h-6 text-white" />
              }
            </div>
            <div>
              <p className={`font-bold text-base leading-tight ${correct ? 'text-emerald-700' : 'text-red-700'}`}>
                {correct ? 'Bonne réponse !' : 'Réponse incorrecte'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Votre réponse :&nbsp;
                <span className={`font-semibold ${result?.reponse_etudiant === 'malade' ? 'text-red-600' : 'text-primary'}`}>
                  {result?.reponse_etudiant === 'malade' ? 'Positif (Malade)' : 'Négatif (Sain)'}
                </span>
              </p>
            </div>
          </div>

          {/* AI analysis */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Diagnostic IA</p>
                <span className={`text-sm font-bold ${result?.reponse_modele === 'malade' ? 'text-red-600' : 'text-primary'}`}>
                  {result?.reponse_modele === 'malade' ? '🔴 Positif (Malade)' : '🟢 Négatif (Sain)'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-0.5">Modèle IA</p>
                <p className="text-xs font-medium text-slate-600 max-w-[120px] text-right leading-snug">
                  {result?.model_id ?? 'HuggingFace ViT'}
                </p>
              </div>
            </div>

            {confidence != null && <ConfidenceBar value={confidence} />}

            <Button
              onClick={() => {
                if (isLast) {
                  onFinish(feedback)
                } else {
                  setCurrent((c) => c + 1)
                }
              }}
              className="w-full"
              size="lg"
            >
              {isLast ? 'Voir mes résultats finaux' : 'Image suivante →'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Phase 3: Score screen ──────────────────────────────────────────────────

function ScoreScreen({ feedback, exerciseId, onRestart, onGoExercises }) {
  const score = feedback?.score ?? 0
  const pct = Math.round(score)
  const results = feedback?.image_results ?? []
  const correctCount = results.filter((r) => r.correct).length
  const incorrectCount = results.length - correctCount

  const radius = 54
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ
  const ringColor = pct >= 80 ? '#1D9E75' : pct >= 60 ? '#f59e0b' : '#ef4444'

  const { emoji, title, sub } =
    pct >= 80
      ? { emoji: '🎉', title: 'Excellent travail !', sub: 'Vous maîtrisez parfaitement ce diagnostic.' }
      : pct >= 60
      ? { emoji: '👍', title: 'Bien joué !', sub: 'Quelques points restent à consolider.' }
      : { emoji: '💪', title: 'Continuez à pratiquer !', sub: 'Revoyez les concepts fondamentaux.' }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm max-w-md w-full p-8 text-center">
        <div className="text-4xl mb-4">{emoji}</div>

        {/* Score ring */}
        <div className="relative inline-flex items-center justify-center mb-5">
          <svg className="rotate-[-90deg]" width="140" height="140">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
            <circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="12"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="font-heading font-bold text-4xl text-slate-900">{pct}%</span>
            <span className="text-xs text-slate-400 font-medium">score</span>
          </div>
        </div>

        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-1.5">{title}</h2>
        <p className="text-slate-500 text-sm mb-7">{sub}</p>

        {/* Stats row */}
        <div className="flex justify-center gap-8 py-5 bg-slate-50 rounded-2xl mb-7">
          <div className="text-center">
            <p className="font-heading font-bold text-2xl text-emerald-600">{correctCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Correctes</p>
          </div>
          <div className="w-px bg-slate-200" />
          <div className="text-center">
            <p className="font-heading font-bold text-2xl text-red-500">{incorrectCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Incorrectes</p>
          </div>
          <div className="w-px bg-slate-200" />
          <div className="text-center">
            <p className="font-heading font-bold text-2xl text-slate-700">{results.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Total</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onRestart} className="flex-1">
            <IconPlay className="w-4 h-4 mr-1.5" />
            Recommencer
          </Button>
          <Button onClick={onGoExercises} className="flex-1">
            Autres exercices
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Root page ──────────────────────────────────────────────────────────────

export default function ExercisePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [phase, setPhase] = useState('info')   // 'info' | 'session' | 'review' | 'score'
  const [session, setSession] = useState(null)
  const [attemptId, setAttemptId] = useState(null)
  const [finalFeedback, setFinalFeedback] = useState(null)

  const { data: exercise, isLoading } = useQuery({
    queryKey: ['exercise', id],
    queryFn: () => exercisesApi.get(id),
  })

  const startMutation = useMutation({
    mutationFn: () => exercisesApi.start(id),
    onSuccess: (data) => {
      setSession({ ...data, exercise_id: parseInt(id) })
      setPhase('session')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (payload) => attemptsApi.submit(payload),
    onSuccess: (data) => {
      setAttemptId(data.id)
      setPhase('review')
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
      {/* Back link — only shown on info screen */}
      {phase === 'info' && (
        <div className="absolute top-4 left-72 z-10">
          <Link
            to="/exercises"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            <IconArrowLeft className="w-4 h-4" />
            Exercices
          </Link>
        </div>
      )}

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

      {phase === 'review' && attemptId && (
        <ReviewScreen
          attemptId={attemptId}
          onFinish={(fb) => {
            setFinalFeedback(fb)
            setPhase('score')
          }}
        />
      )}

      {phase === 'score' && finalFeedback && (
        <ScoreScreen
          feedback={finalFeedback}
          exerciseId={id}
          onRestart={() => {
            setSession(null)
            setAttemptId(null)
            setFinalFeedback(null)
            setPhase('info')
          }}
          onGoExercises={() => navigate('/exercises')}
        />
      )}

      {(startMutation.isError || submitMutation.isError) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50">
          {startMutation.isError ? 'Impossible de démarrer la session.' : 'Erreur lors de la soumission.'} Réessayez.
        </div>
      )}
    </div>
  )
}
