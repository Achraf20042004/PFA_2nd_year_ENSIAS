import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { exercisesApi } from '../api/exercises'
import { attemptsApi }  from '../api/attempts'
import LoadingSpinner   from '../components/LoadingSpinner'
import Button           from '../components/Button'
import { DOMAIN_META }  from '../styles/theme'
import { IconArrowLeft, IconClock, IconPlay } from '../components/icons'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Domain gradient map ──────────────────────────────────────────────────────

const DOMAIN_GRADIENT = {
  pneumonie: 'from-blue-600 to-blue-800',
  melanome:  'from-orange-500 to-rose-700',
  tumeur:    'from-violet-600 to-purple-900',
}
const DOMAIN_ACCENT = {
  pneumonie: '#3b82f6',
  melanome:  '#f97316',
  tumeur:    '#7c3aed',
}

// ─── Phase 0 : Info ───────────────────────────────────────────────────────────

function InfoScreen({ exercise, onStart, loading }) {
  const domain   = DOMAIN_META[exercise.maladie] ?? { sublabel: exercise.maladie, bg: 'bg-slate-100', text: 'text-slate-600' }
  const gradient = DOMAIN_GRADIENT[exercise.maladie] ?? 'from-slate-600 to-slate-900'
  const nb       = exercise.exam_config?.nb_images ?? 10
  const isExam   = exercise.exam_config?.est_examen

  const diffColors = {
    facile:    { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    moyen:     { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
    difficile: { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500'     },
  }
  const diff = diffColors[exercise.difficulte] ?? diffColors.moyen

  return (
    <div className="min-h-[calc(100vh-52px)] flex items-center justify-center p-6 bg-[#F7FFFE]">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-lg w-full"
      >
        <Link
          to="/exercises"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors font-medium mb-5"
        >
          <IconArrowLeft className="w-4 h-4" />
          Retour aux exercices
        </Link>

        <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100">

          {/* ── Gradient header — no negative margins, no absolute blobs ── */}
          <div className={`bg-gradient-to-br ${gradient} px-7 py-8`}>
            <span className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5 border border-white/25">
              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
              {domain.sublabel}
            </span>
            <h1 className="font-heading text-2xl font-bold text-white leading-snug">
              {exercise.titre ?? domain.label ?? 'Exercice'}
            </h1>
            {exercise.description && (
              <p className="text-white/60 text-sm mt-2 leading-relaxed">{exercise.description}</p>
            )}
          </div>

          {/* ── Stats row — flat, no overlap ── */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
            <div className="text-center py-4 px-3">
              <p className="font-heading font-bold text-2xl text-slate-900">{nb}</p>
              <p className="text-xs text-slate-400 mt-0.5">Images</p>
            </div>
            <div className="text-center py-4 px-3 flex flex-col items-center justify-center gap-1.5">
              <div className={`inline-flex items-center gap-1.5 ${diff.bg} px-2.5 py-1 rounded-full`}>
                <span className={`w-1.5 h-1.5 rounded-full ${diff.dot} shrink-0`} />
                <span className={`text-xs font-semibold capitalize ${diff.text}`}>{exercise.difficulte}</span>
              </div>
              <p className="text-xs text-slate-400">Difficulté</p>
            </div>
            <div className="text-center py-4 px-3">
              <p className="text-2xl">{isExam ? '🎓' : '📚'}</p>
              <p className="text-xs text-slate-400 mt-0.5">{isExam ? 'Examen' : 'Pratique'}</p>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-6 py-5 space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Instructions</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Pour chaque image médicale, indiquez si le patient est{' '}
                <span className="font-semibold text-red-600">Positif</span> (malade) ou{' '}
                <span className="font-semibold text-emerald-600">Négatif</span> (sain).
                Les touches{' '}
                <kbd className="bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono shadow-sm">1</kbd>
                {' '}et{' '}
                <kbd className="bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono shadow-sm">2</kbd>
                {' '}permettent de répondre rapidement.
              </p>
            </div>

            {exercise.exam_config?.max_tentatives && (
              <div className="flex items-center gap-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span>Maximum <strong>{exercise.exam_config.max_tentatives}</strong> tentative{exercise.exam_config.max_tentatives > 1 ? 's' : ''} autorisée{exercise.exam_config.max_tentatives > 1 ? 's' : ''}</span>
              </div>
            )}

            <Button onClick={onStart} loading={loading} className="w-full" size="lg">
              <IconPlay className="w-4 h-4" />
              Commencer l'exercice
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Phase 1 : Diagnosis ──────────────────────────────────────────────────────

function DiagnosisScreen({ session, exercise, onSubmit, submitting }) {
  const images    = session.images ?? []
  const [current, setCurrent]   = useState(0)
  const [answers, setAnswers]   = useState({})
  const [elapsed, setElapsed]   = useState(0)
  const [direction, setDirection] = useState(1)
  const [zoomed, setZoomed]     = useState(false)
  const startRef  = useRef(Date.now())

  const accent   = DOMAIN_ACCENT[exercise?.maladie] ?? '#1B5E3B'
  const gradient = DOMAIN_GRADIENT[exercise?.maladie] ?? 'from-slate-600 to-slate-800'

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const answered      = Object.keys(answers).length
  const progress      = images.length > 0 ? (answered / images.length) * 100 : 0
  const img           = images[current]
  const currentAnswer = img ? answers[img.id] : null
  const allAnswered   = images.length > 0 && answered === images.length

  const goTo = useCallback((idx, dir) => {
    setDirection(dir)
    setCurrent(idx)
    setZoomed(false)
  }, [])

  const goNext = useCallback(() => {
    if (current < images.length - 1) goTo(current + 1, 1)
  }, [current, images.length, goTo])

  const goPrev = useCallback(() => {
    if (current > 0) goTo(current - 1, -1)
  }, [current, goTo])

  function handleAnswer(value) {
    if (!img) return
    setAnswers((prev) => ({ ...prev, [img.id]: value }))
    if (current < images.length - 1) {
      setTimeout(() => goTo(current + 1, 1), 280)
    }
  }

  function handleSubmit() {
    onSubmit({
      exercise:     session.exercise_id,
      duree_reelle: Math.max(1, elapsed),
      mode:         session.mode ?? 'practice',
      answers:      images.map((i) => ({
        image_id:         i.id,
        reponse_etudiant: answers[i.id] ?? 'sain',
      })),
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === '1') handleAnswer('malade')
      if (e.key === '2') handleAnswer('sain')
      if (e.key === 'z' || e.key === 'Z') setZoomed((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev, img])

  // Progress ring
  const ringR    = 16
  const ringCirc = 2 * Math.PI * ringR
  const ringOff  = ringCirc - (progress / 100) * ringCirc

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 52px)' }}>

      {/* ── Top bar ── */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-5 py-2 flex items-center gap-4">

        {/* Progress ring */}
        <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
          <svg width="40" height="40" className="rotate-[-90deg]">
            <circle cx="20" cy="20" r={ringR} fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
            <circle
              cx="20" cy="20" r={ringR}
              fill="none" stroke={accent} strokeWidth="3.5"
              strokeDasharray={ringCirc} strokeDashoffset={ringOff}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.35s ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-600">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">{answered}</span>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-400">{images.length}</span>
          <span className="text-xs text-slate-400 hidden sm:block">diagnostiquées</span>
        </div>

        {/* Dot strip */}
        <div className="flex-1 hidden md:flex items-center gap-1 overflow-x-auto py-1">
          {images.map((im, i) => (
            <button
              key={im.id}
              onClick={() => goTo(i, i > current ? 1 : -1)}
              title={`Image ${i + 1}${answers[im.id] ? ` — ${answers[im.id] === 'malade' ? 'Positif' : 'Négatif'}` : ''}`}
              className={`shrink-0 rounded-full transition-all duration-200 ${
                i === current
                  ? 'w-5 h-2.5 rounded-full'
                  : 'w-2 h-2'
              }`}
              style={{
                background: i === current
                  ? accent
                  : answers[im.id]
                  ? answers[im.id] === 'malade' ? '#ef4444' : '#10b981'
                  : '#e2e8f0',
              }}
            />
          ))}
        </div>

        {/* Timer */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-sm font-semibold text-slate-500 shrink-0">
          <IconClock className="w-3.5 h-3.5 text-slate-400" />
          {formatTime(elapsed)}
        </div>

        {allAnswered && (
          <Button onClick={handleSubmit} loading={submitting} size="sm" className="shrink-0 ml-2">
            Valider les réponses →
          </Button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ════════ IMAGE PANEL ════════ */}
        <div className="flex-1 min-w-0 bg-[#080E0A] flex flex-col relative">

          {/* Image zone */}
          <div
            className={`flex-1 flex items-center justify-center overflow-hidden relative ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            onClick={() => setZoomed((v) => !v)}
          >
            {/* Subtle grid overlay — DICOM feel */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            <AnimatePresence mode="wait" custom={direction}>
              {img && (
                <motion.img
                  key={img.id}
                  src={img.url ?? img.chemin}
                  alt={`Image médicale ${current + 1}`}
                  custom={direction}
                  variants={{
                    enter:  (d) => ({ opacity: 0, x: d * 60, scale: 0.97 }),
                    center: {    opacity: 1, x: 0,      scale: zoomed ? 1.5 : 1 },
                    exit:   (d) => ({ opacity: 0, x: d * -60, scale: 0.97 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  className="select-none"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.parentElement.querySelector('.img-error')?.style?.setProperty('display', 'flex')
                  }}
                  draggable={false}
                />
              )}
            </AnimatePresence>

            {/* Image error fallback */}
            <div className="img-error hidden absolute inset-0 flex-col items-center justify-center text-white/30 gap-3">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <span className="text-sm">Image non disponible</span>
            </div>

            {/* Corner overlays */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="bg-black/60 backdrop-blur-sm text-white/90 text-xs font-mono px-3 py-1.5 rounded-lg border border-white/10 tracking-wider">
                {String(current + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </div>
              {zoomed && (
                <div className="bg-black/60 backdrop-blur-sm text-white/60 text-[10px] px-2.5 py-1.5 rounded-lg border border-white/10">
                  ZOOM ×1.5
                </div>
              )}
            </div>

            {currentAnswer && (
              <motion.div
                key={`badge-${currentAnswer}`}
                initial={{ opacity: 0, scale: 0.8, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`absolute top-4 right-4 text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur-sm border tracking-wide ${
                  currentAnswer === 'malade'
                    ? 'bg-red-500/85 border-red-300/20 text-white'
                    : 'bg-emerald-600/85 border-emerald-300/20 text-white'
                }`}
              >
                {currentAnswer === 'malade' ? '● POSITIF' : '● NÉGATIF'}
              </motion.div>
            )}

            {/* Keyboard hint bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-sm text-white/35 text-[10px] px-4 py-2 rounded-xl border border-white/5">
              <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono mr-1">1</kbd>Positif</span>
              <span className="text-white/15">|</span>
              <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono mr-1">2</kbd>Négatif</span>
              <span className="text-white/15">|</span>
              <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono mr-1">←→</kbd>Naviguer</span>
              <span className="text-white/15">|</span>
              <span><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono mr-1">Z</kbd>Zoom</span>
            </div>

            {/* Prev / Next arrow buttons on image */}
            <button
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              disabled={current === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white/60 hover:text-white disabled:opacity-20 transition-all flex items-center justify-center backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext() }}
              disabled={current === images.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white/60 hover:text-white disabled:opacity-20 transition-all flex items-center justify-center backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Bottom filmstrip */}
          <div className="shrink-0 h-14 bg-black/40 backdrop-blur-sm border-t border-white/5 flex items-center px-4 gap-1.5 overflow-x-auto">
            {images.map((im, i) => (
              <button
                key={im.id}
                onClick={() => goTo(i, i > current ? 1 : -1)}
                className={`shrink-0 w-8 h-8 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                  i === current
                    ? 'border-white scale-110 shadow-lg shadow-white/20'
                    : answers[im.id]
                    ? answers[im.id] === 'malade'
                      ? 'border-red-400/70 opacity-80 hover:opacity-100'
                      : 'border-emerald-400/70 opacity-80 hover:opacity-100'
                    : 'border-white/10 opacity-50 hover:opacity-80'
                }`}
              >
                <img
                  src={im.url ?? im.chemin}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                  onError={(e) => { e.target.style.background = '#1e293b' }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* ════════ CONTROLS PANEL ════════ */}
        <div className="w-72 shrink-0 bg-white border-l border-slate-100 flex flex-col overflow-y-auto">

          {/* Panel header — domain stripe */}
          <div className={`bg-gradient-to-r ${gradient} px-5 py-4 shrink-0`}>
            <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase mb-0.5">Diagnostic</p>
            <p className="text-white font-heading font-bold text-lg leading-tight">
              Image {current + 1}
              <span className="text-white/40 font-normal text-sm"> / {images.length}</span>
            </p>
          </div>

          {/* Answered summary chips */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-100">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              {Object.values(answers).filter((v) => v === 'malade').length} Positif
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              {Object.values(answers).filter((v) => v === 'sain').length} Négatif
            </div>
            <span className="ml-auto text-xs text-slate-400">{images.length - answered} restantes</span>
          </div>

          {/* Diagnosis question */}
          <div className="px-5 pt-5 pb-3 shrink-0">
            <p className="text-center text-sm font-semibold text-slate-600 mb-1">Ce patient est-il malade ?</p>
            <p className="text-center text-xs text-slate-400">Analysez l'image et choisissez</p>
          </div>

          {/* Answer buttons */}
          <div className="px-4 space-y-3 flex-1 pb-4">

            {/* POSITIF */}
            <motion.button
              onClick={() => handleAnswer('malade')}
              whileTap={{ scale: 0.97 }}
              className={`w-full rounded-2xl border-2 transition-all duration-200 py-5 text-center relative overflow-hidden group ${
                currentAnswer === 'malade'
                  ? 'bg-red-500 border-red-500 text-white shadow-xl shadow-red-200'
                  : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/50'
              }`}
            >
              {currentAnswer === 'malade' && (
                <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-600 opacity-20" />
              )}
              <div className={`w-12 h-12 rounded-2xl mx-auto mb-2.5 flex items-center justify-center text-2xl transition-colors ${
                currentAnswer === 'malade' ? 'bg-white/15' : 'bg-red-100 group-hover:bg-red-200'
              }`}>
                🔴
              </div>
              <p className={`font-bold text-base ${currentAnswer === 'malade' ? 'text-white' : 'text-slate-800'}`}>
                Positif
              </p>
              <p className={`text-xs mt-0.5 ${currentAnswer === 'malade' ? 'text-white/70' : 'text-slate-400'}`}>
                Patient malade
              </p>
              {currentAnswer === 'malade' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 bg-white/25 rounded-full flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </motion.div>
              )}
              <p className={`text-[10px] mt-2 font-mono ${currentAnswer === 'malade' ? 'text-white/40' : 'text-slate-300'}`}>
                touche 1
              </p>
            </motion.button>

            {/* NÉGATIF */}
            <motion.button
              onClick={() => handleAnswer('sain')}
              whileTap={{ scale: 0.97 }}
              className={`w-full rounded-2xl border-2 transition-all duration-200 py-5 text-center relative overflow-hidden group ${
                currentAnswer === 'sain'
                  ? 'bg-[#1B5E3B] border-[#1B5E3B] text-white shadow-xl shadow-emerald-200'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
              }`}
            >
              {currentAnswer === 'sain' && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-[#1B5E3B] opacity-20" />
              )}
              <div className={`w-12 h-12 rounded-2xl mx-auto mb-2.5 flex items-center justify-center text-2xl transition-colors ${
                currentAnswer === 'sain' ? 'bg-white/15' : 'bg-emerald-100 group-hover:bg-emerald-200'
              }`}>
                🟢
              </div>
              <p className={`font-bold text-base ${currentAnswer === 'sain' ? 'text-white' : 'text-slate-800'}`}>
                Négatif
              </p>
              <p className={`text-xs mt-0.5 ${currentAnswer === 'sain' ? 'text-white/70' : 'text-slate-400'}`}>
                Patient sain
              </p>
              {currentAnswer === 'sain' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 bg-white/25 rounded-full flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </motion.div>
              )}
              <p className={`text-[10px] mt-2 font-mono ${currentAnswer === 'sain' ? 'text-white/40' : 'text-slate-300'}`}>
                touche 2
              </p>
            </motion.button>
          </div>

          {/* All answered — submit */}
          <AnimatePresence>
            {allAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 pb-4 pt-2 border-t border-slate-100 bg-emerald-50/50 shrink-0"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs font-semibold text-emerald-700">
                    Toutes les images diagnostiquées !
                  </p>
                </div>
                <Button onClick={handleSubmit} loading={submitting} className="w-full">
                  Valider mes réponses →
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function ExercisePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [phase,   setPhase]   = useState('info')
  const [session, setSession] = useState(null)

  const { data: exercise, isLoading } = useQuery({
    queryKey: ['exercise', id],
    queryFn:  () => exercisesApi.get(id),
  })

  const startMutation = useMutation({
    mutationFn: () => exercisesApi.start(id),
    onSuccess:  (data) => {
      setSession({ ...data, exercise_id: parseInt(id) })
      setPhase('session')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (payload) => attemptsApi.submit(payload),
    onSuccess:  (data)    => navigate(`/exercises/${id}/feedback/${data.id}`),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7FFFE]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[#F7FFFE]">
        <p className="text-slate-500">Exercice introuvable.</p>
        <Link to="/exercises" className="text-sm text-primary-dark font-semibold hover:underline">
          ← Retour aux exercices
        </Link>
      </div>
    )
  }

  return (
    <>
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
          exercise={exercise}
          onSubmit={submitMutation.mutate}
          submitting={submitMutation.isPending}
        />
      )}

      {/* Error toast */}
      <AnimatePresence>
        {(startMutation.isError || submitMutation.isError) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50 flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {startMutation.isError
              ? 'Impossible de démarrer la session.'
              : 'Erreur lors de la soumission — vérifiez votre connexion.'}{' '}
            Réessayez.
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
