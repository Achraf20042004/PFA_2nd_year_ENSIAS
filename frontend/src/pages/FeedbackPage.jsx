import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { attemptsApi }  from '../api/attempts'
import LoadingSpinner   from '../components/LoadingSpinner'
import Button           from '../components/Button'
import { DOMAIN_META }  from '../styles/theme'
import { IconCheck, IconX, IconArrowLeft, IconBook, IconPlay } from '../components/icons'

// ─── Score config ─────────────────────────────────────────────────────────────

const SCORE_CFG = [
  { min: 90, label: 'Excellent !',   emoji: '🏆', gradient: 'from-emerald-500 via-teal-500 to-cyan-600',   ring: '#10b981', text: 'text-emerald-600', pill: 'bg-emerald-100 text-emerald-700' },
  { min: 70, label: 'Très bien !',   emoji: '🌟', gradient: 'from-blue-500 via-blue-600 to-indigo-700',     ring: '#3b82f6', text: 'text-blue-600',    pill: 'bg-blue-100 text-blue-700'    },
  { min: 50, label: 'Bien joué !',   emoji: '👍', gradient: 'from-amber-400 via-orange-500 to-rose-500',    ring: '#f59e0b', text: 'text-amber-600',   pill: 'bg-amber-100 text-amber-700'  },
  { min: 0,  label: 'À améliorer',   emoji: '💪', gradient: 'from-slate-500 via-slate-600 to-slate-800',    ring: '#64748b', text: 'text-slate-600',   pill: 'bg-slate-100 text-slate-700'  },
]
function getScoreCfg(pct) { return SCORE_CFG.find((c) => pct >= c.min) ?? SCORE_CFG[3] }

// ─── Animated score ring ──────────────────────────────────────────────────────

function AnimatedRing({ score, ringColor }) {
  const [val, setVal] = useState(0)
  const r    = 50
  const circ = 2 * Math.PI * r

  useEffect(() => {
    let raf
    const start = performance.now()
    const dur   = 1400
    const tick  = (now) => {
      const t    = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(score * ease))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score])

  const offset = circ - (val / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width="124" height="124" className="rotate-[-90deg] drop-shadow-lg">
        <circle cx="62" cy="62" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
        <circle
          cx="62" cy="62" r={r}
          fill="none" stroke="white" strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.04s linear' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-heading font-black text-3xl text-white leading-none tabular-nums">{val}%</span>
        <span className="text-white/60 text-[10px] font-medium tracking-widest uppercase mt-0.5">score</span>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, sub, colorClass, borderClass }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${borderClass ?? 'border-slate-100'}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`font-heading font-bold text-2xl leading-none ${colorClass ?? 'text-slate-800'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1 font-medium">{label}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── ImageResultCard ──────────────────────────────────────────────────────────

function ImageResultCard({ result, index }) {
  const [showGradcam, setShowGradcam] = useState(false)
  const correct    = result.correct
  const confidence = result.ml_confidence != null ? Math.round(result.ml_confidence * 100) : null
  const hasGradcam = !!result.gradcam_path
  const studentPos = result.reponse_etudiant === 'malade'
  const aiPos      = result.reponse_modele   === 'malade'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
      className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
        correct ? 'border-slate-100' : 'border-red-100 ring-1 ring-red-50'
      }`}
    >
      {/* ── Image ── */}
      <div className="relative bg-[#070C09]" style={{ aspectRatio: '4/3' }}>
        {(result.url ?? result.chemin) ? (
          <img
            src={result.url ?? result.chemin}
            alt={`Image ${index + 1}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-2">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <span className="text-xs">Image indisponible</span>
          </div>
        )}

        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {/* Index */}
        <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white/90 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border border-white/10 tracking-wider">
          #{String(index + 1).padStart(2, '0')}
        </div>

        {/* Verdict */}
        <div className={`absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold backdrop-blur-sm border ${
          correct
            ? 'bg-emerald-500/90 border-emerald-300/20 text-white'
            : 'bg-red-500/90 border-red-300/20 text-white'
        }`}>
          {correct
            ? <><IconCheck className="w-3 h-3" /> Correct</>
            : <><IconX className="w-3 h-3" /> Incorrect</>
          }
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-3">

        {/* Comparison row */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl p-3 border text-center ${
            studentPos ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
          }`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Votre réponse</p>
            <div className={`flex items-center justify-center gap-1.5 text-sm font-bold ${
              studentPos ? 'text-red-600' : 'text-emerald-700'
            }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${studentPos ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {studentPos ? 'Positif' : 'Négatif'}
            </div>
          </div>
          <div className={`rounded-xl p-3 border text-center ${
            aiPos ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
          }`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Réponse IA</p>
            <div className={`flex items-center justify-center gap-1.5 text-sm font-bold ${
              aiPos ? 'text-red-600' : 'text-emerald-700'
            }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${aiPos ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {aiPos ? 'Positif' : 'Négatif'}
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        {confidence != null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Confiance IA</span>
              <span className={`text-xs font-bold ${
                confidence >= 80 ? 'text-emerald-600' : confidence >= 60 ? 'text-amber-500' : 'text-red-500'
              }`}>{confidence}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confidence}%` }}
                transition={{ delay: index * 0.04 + 0.4, duration: 0.7, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  confidence >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                  : confidence >= 60 ? 'bg-gradient-to-r from-amber-300 to-amber-500'
                  : 'bg-gradient-to-r from-red-300 to-red-500'
                }`}
              />
            </div>
          </div>
        )}

        {/* Grad-CAM */}
        {!correct && hasGradcam && (
          <div>
            <button
              onClick={() => setShowGradcam((v) => !v)}
              className="w-full flex items-center justify-center gap-2 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 py-2 rounded-xl transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              {showGradcam ? 'Masquer' : 'Afficher'} la carte Grad-CAM
            </button>
            <AnimatePresence>
              {showGradcam && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 rounded-xl overflow-hidden bg-slate-900">
                    <img src={result.gradcam_path} alt="Grad-CAM" className="w-full object-contain max-h-44" />
                  </div>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    Zones d'activation — attention du modèle IA
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { id: exerciseId, attemptId } = useParams()
  const navigate = useNavigate()

  const { data: feedback, isLoading, isError } = useQuery({
    queryKey: ['feedback', attemptId],
    queryFn:  () => attemptsApi.feedback(attemptId),
    staleTime: Infinity,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7FFFE]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !feedback) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#F7FFFE]">
        <p className="text-slate-500">Résultats introuvables.</p>
        <Link to="/exercises" className="text-sm text-primary-dark font-semibold hover:underline">← Retour</Link>
      </div>
    )
  }

  const score         = Math.round((feedback.score ?? 0) * 100)
  const results       = feedback.image_results ?? []
  const correctCount  = results.filter((r) => r.correct).length
  const incorrectCount = results.length - correctCount
  const avgConf       = results.length > 0
    ? Math.round(results.reduce((a, r) => a + (r.ml_confidence ?? 0), 0) / results.length * 100)
    : null
  const cfg        = getScoreCfg(score)
  const domainMeta = DOMAIN_META[feedback.exercise?.maladie] ?? null
  const accuracy   = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F0F5F2]">

      {/* ══ HERO ══ */}
      <div className={`bg-gradient-to-br ${cfg.gradient}`}>
        <div className="max-w-4xl mx-auto px-6 pt-5 pb-6">
          <Link
            to="/exercises"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors mb-5"
          >
            <IconArrowLeft className="w-4 h-4" />
            Retour aux exercices
          </Link>

          <div className="flex items-center gap-6">
            <AnimatedRing score={score} ringColor={cfg.ring} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">{cfg.emoji}</span>
                <h1 className="font-heading text-2xl font-black text-white leading-tight">{cfg.label}</h1>
              </div>
              <p className="text-white/65 text-sm">
                {correctCount} correcte{correctCount > 1 ? 's' : ''} sur {results.length} image{results.length > 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {domainMeta && (
                  <span className="inline-flex items-center gap-1.5 bg-white/15 text-white/90 text-xs font-semibold px-3 py-1 rounded-full border border-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />{domainMeta.sublabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 bg-white/15 text-white/90 text-xs font-semibold px-3 py-1 rounded-full border border-white/20">
                  {accuracy}% de réussite
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div className="max-w-4xl mx-auto px-6 pb-12">

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 mb-6">
          <StatCard icon="✅" value={correctCount} label="Correctes"     colorClass="text-emerald-600" borderClass="border-emerald-100 border-l-4 border-l-emerald-500" />
          <StatCard icon="❌" value={incorrectCount} label="Incorrectes" colorClass="text-red-500"     borderClass="border-red-100 border-l-4 border-l-red-400" />
          <StatCard icon="📷" value={results.length} label="Images total" colorClass="text-slate-700"  borderClass="border-slate-200 border-l-4 border-l-slate-400" />
          {avgConf != null
            ? <StatCard icon="🤖" value={`${avgConf}%`} label="Confiance IA moy." sub="précision du modèle" colorClass="text-indigo-600" borderClass="border-indigo-100 border-l-4 border-l-indigo-400" />
            : <StatCard icon="⏱" value={`${score}%`} label="Score final" colorClass={cfg.text} borderClass="border-slate-200 border-l-4 border-l-slate-400" />
          }
        </div>

        {/* ── Proportions bar ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-700">Répartition des réponses</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.pill}`}>{accuracy}% réussite</span>
          </div>
          {/* Segmented bar */}
          <div className="flex rounded-full overflow-hidden h-4 gap-px bg-slate-100">
            {results.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.025, duration: 0.2 }}
                title={`Image ${i + 1} — ${r.correct ? '✅ Correct' : '❌ Incorrect'}`}
                className={`flex-1 h-full cursor-default transition-opacity hover:opacity-80 ${
                  r.correct ? 'bg-emerald-500' : 'bg-red-400'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-5 mt-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              Correct ({correctCount})
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-3 h-3 rounded-sm bg-red-400" />
              Incorrect ({incorrectCount})
            </div>
          </div>
        </div>

        {/* ── Course recommendation ── */}
        {feedback.cours_recommande && (
          <div className="bg-gradient-to-r from-[#1B5E3B] to-[#2E7D52] rounded-2xl p-5 mb-5 flex items-start gap-4">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
              <IconBook className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Cours recommandé</p>
              <p className="text-white font-bold text-base leading-snug">{feedback.cours_recommande.titre}</p>
              {feedback.cours_recommande.id && (
                <Link
                  to={`/courses/${feedback.cours_recommande.id}`}
                  className="inline-flex items-center gap-1 text-white/80 hover:text-white text-xs font-semibold mt-2 transition-colors"
                >
                  Voir le cours →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3 mb-8">
          <Button variant="outline" onClick={() => navigate(`/exercises/${exerciseId}`)} className="flex-1">
            <IconPlay className="w-4 h-4" />
            Recommencer
          </Button>
          <Button onClick={() => navigate('/exercises')} className="flex-1">
            Autres exercices →
          </Button>
        </div>

        {/* ── Per-image breakdown ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-slate-900 text-xl">Analyse image par image</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{correctCount} ✓
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />{incorrectCount} ✗
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((r, i) => (
              <ImageResultCard key={r.id ?? i} result={r} index={i} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
