import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { attemptsApi } from '../api/attempts'
import LoadingSpinner from '../components/LoadingSpinner'
import Button from '../components/Button'
import { IconCheck, IconX, IconArrowLeft, IconBook, IconPlay } from '../components/icons'

function ScoreRing({ score }) {
  const pct = Math.round(score ?? 0)
  const radius = 52
  const circ = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ
  const color = pct >= 80 ? '#1D9E75' : pct >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="rotate-[-90deg]" width="128" height="128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-heading font-bold text-3xl text-slate-900">{pct}%</span>
        <span className="text-xs text-slate-400">score</span>
      </div>
    </div>
  )
}

function ImageResultCard({ result, index }) {
  const correct = result.correct
  const hasGradcam = !!result.gradcam_path
  const confidence = result.ml_confidence != null ? Math.round(result.ml_confidence * 100) : null
  const hasRecommendation = !!result.cours_recommande

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${correct ? 'border-slate-100' : 'border-red-100'}`}>
      {/* Image */}
      <div className="relative bg-slate-900 aspect-video max-h-48 flex items-center justify-center overflow-hidden">
        {(result.image?.url ?? result.image?.chemin) ? (
          <img
            src={result.image.url ?? result.image.chemin}
            alt={`Image ${index + 1}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <p className="text-slate-500 text-xs">Image non disponible</p>
        )}

        {/* Verdict badge */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          correct ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {correct
            ? <><IconCheck className="w-3.5 h-3.5" /> Correct</>
            : <><IconX className="w-3.5 h-3.5" /> Incorrect</>
          }
        </div>

        {/* Image index */}
        <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
          #{index + 1}
        </div>
      </div>

      {/* Grad-CAM overlay */}
      {!correct && hasGradcam && (
        <div className="border-t border-slate-100">
          <p className="text-xs text-slate-400 px-4 pt-3 pb-1.5 font-medium">Carte d'activation (Grad-CAM)</p>
          <img
            src={result.gradcam_path}
            alt="Grad-CAM"
            className="w-full max-h-40 object-contain bg-slate-50"
          />
        </div>
      )}

      {/* Details */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Votre réponse</p>
              <span className={`font-semibold capitalize ${result.reponse_etudiant === 'malade' ? 'text-red-600' : 'text-primary'}`}>
                {result.reponse_etudiant === 'malade' ? 'Positif' : 'Négatif'}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Réponse IA</p>
              <span className={`font-semibold capitalize ${result.reponse_modele === 'malade' ? 'text-red-600' : 'text-primary'}`}>
                {result.reponse_modele === 'malade' ? 'Positif' : 'Négatif'}
              </span>
            </div>
            {confidence != null && (
              <>
                <div className="w-px h-8 bg-slate-100" />
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Confiance IA</p>
                  <span className="font-semibold text-slate-700">{confidence}%</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Course recommendation */}
        {hasRecommendation && (
          <div className="mt-3 bg-primary-light border border-primary/20 rounded-xl p-3 flex items-start gap-3">
            <IconBook className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-primary mb-0.5">Cours recommandé</p>
              <p className="text-sm text-slate-700">{result.cours_recommande.titre}</p>
              {result.cours_recommande.id && (
                <Link
                  to={`/courses/${result.cours_recommande.id}`}
                  className="text-xs text-primary font-medium hover:underline mt-1 inline-block"
                >
                  Voir le cours →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  const { id: exerciseId, attemptId } = useParams()
  const navigate = useNavigate()

  const { data: feedback, isLoading, isError } = useQuery({
    queryKey: ['feedback', attemptId],
    queryFn: () => attemptsApi.feedback(attemptId),
    staleTime: Infinity,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !feedback) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-slate-500">Résultats introuvables.</p>
        <Link to="/exercises" className="text-sm text-primary hover:underline">← Retour aux exercices</Link>
      </div>
    )
  }

  const score = feedback.score ?? 0
  const results = feedback.image_results ?? []
  const correctCount = results.filter((r) => r.correct).length
  const incorrectCount = results.length - correctCount
  const hasCourseRecommendations = results.some((r) => r.cours_recommande)

  const scoreLabel = score >= 80 ? 'Excellent !' : score >= 60 ? 'Bien !' : 'À améliorer'
  const scoreColor = score >= 80 ? 'text-primary' : score >= 60 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Back */}
      <Link
        to="/exercises"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors mb-6"
      >
        <IconArrowLeft className="w-4 h-4" />
        Retour aux exercices
      </Link>

      {/* Score card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 mb-6 flex flex-col items-center text-center">
        <ScoreRing score={score} />
        <h1 className={`font-heading text-2xl font-bold mt-4 mb-1 ${scoreColor}`}>{scoreLabel}</h1>
        <p className="text-slate-500 text-sm">Session terminée</p>

        <div className="flex gap-6 mt-6 pt-6 border-t border-slate-100 w-full justify-center">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 mb-1">
              <IconCheck className="w-4 h-4" />
              <span className="font-heading font-bold text-xl">{correctCount}</span>
            </div>
            <p className="text-xs text-slate-400">Correctes</p>
          </div>
          <div className="w-px bg-slate-100" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-red-500 mb-1">
              <IconX className="w-4 h-4" />
              <span className="font-heading font-bold text-xl">{incorrectCount}</span>
            </div>
            <p className="text-xs text-slate-400">Incorrectes</p>
          </div>
          <div className="w-px bg-slate-100" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-700 mb-1">
              <span className="font-heading font-bold text-xl">{results.length}</span>
            </div>
            <p className="text-xs text-slate-400">Total</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 w-full max-w-xs">
          <Button
            variant="outline"
            onClick={() => navigate(`/exercises/${exerciseId}`)}
            className="flex-1"
          >
            <IconPlay className="w-4 h-4 mr-1.5" />
            Recommencer
          </Button>
          <Button
            onClick={() => navigate('/exercises')}
            className="flex-1"
          >
            Autres exercices
          </Button>
        </div>
      </div>

      {/* Course recommendations summary */}
      {hasCourseRecommendations && (
        <div className="bg-primary-light border border-primary/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <IconBook className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-semibold text-primary text-sm">Cours recommandés</h2>
          </div>
          <p className="text-sm text-slate-600">
            Des cours ont été identifiés pour vous aider à progresser sur vos réponses incorrectes. Consultez-les ci-dessous.
          </p>
        </div>
      )}

      {/* Per-image breakdown */}
      <div className="mb-4">
        <h2 className="font-heading font-semibold text-slate-900 text-lg mb-4">
          Analyse image par image
        </h2>
        <div className="space-y-4">
          {results.map((r, i) => (
            <ImageResultCard key={r.id ?? i} result={r} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
