import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { exercisesApi } from '../api/exercises'
import LoadingSpinner from '../components/LoadingSpinner'
import { IconPlay, IconClock, IconChart } from '../components/icons'

const DOMAINS = [
  { value: '', label: 'Tous' },
  { value: 'pneumonie', label: 'Pneumonie',    sub: 'Radiologie',        color: 'text-blue-600',   bg: 'bg-blue-50',   dot: 'bg-blue-500' },
  { value: 'melanome',  label: 'Dermatologie', sub: 'Mélanome',          color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  { value: 'tumeur',    label: 'Neurologie',   sub: 'Tumeur cérébrale',  color: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500' },
]

const DIFFICULTIES = [
  { value: '', label: 'Toutes' },
  { value: 'facile', label: 'Facile' },
  { value: 'moyen', label: 'Moyen' },
  { value: 'difficile', label: 'Difficile' },
]

const DIFFICULTY_STYLE = {
  facile: 'bg-emerald-100 text-emerald-700',
  moyen: 'bg-amber-100 text-amber-700',
  difficile: 'bg-red-100 text-red-700',
}

const DOMAIN_META = {
  pneumonie: { color: 'text-blue-600',   bg: 'bg-blue-50',   dot: 'bg-blue-500',   label: 'Pneumonie' },
  melanome:  { color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500', label: 'Dermatologie' },
  tumeur:    { color: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500', label: 'Neurologie' },
}

function ExerciseCard({ exercise }) {
  const domain = DOMAIN_META[exercise.maladie] ?? { color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400', label: exercise.maladie }
  const nb = exercise.exam_config?.nb_images ?? 10
  const isExam = exercise.exam_config?.est_examen

  return (
    <Link to={`/exercises/${exercise.id}`} className="group block">
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all h-full flex flex-col">
        {/* Top */}
        <div className="flex items-start justify-between mb-4">
          <div className={`${domain.bg} rounded-xl p-2.5`}>
            <div className={`w-4 h-4 rounded-full ${domain.dot}`} />
          </div>
          <div className="flex gap-2">
            {isExam && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-900 text-white">
                Examen
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_STYLE[exercise.difficulte] ?? 'bg-slate-100 text-slate-600'}`}>
              {exercise.difficulte}
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="flex-1">
          <p className={`text-xs font-semibold ${domain.color} uppercase tracking-wide mb-1.5`}>
            {domain.label}
          </p>
          <h3 className="font-heading font-semibold text-slate-900 text-base mb-2 leading-snug">
            {exercise.titre ?? `${domain.label} — ${exercise.difficulte ?? 'Entraînement'}`}
          </h3>
          {exercise.description && (
            <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
              {exercise.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <IconChart className="w-3.5 h-3.5" />
              {nb} images
            </span>
            {exercise.exam_config?.duree_minutes && (
              <span className="flex items-center gap-1">
                <IconClock className="w-3.5 h-3.5" />
                {exercise.exam_config.duree_minutes} min
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-dark opacity-0 group-hover:opacity-100 transition-opacity">
            <IconPlay className="w-3.5 h-3.5" />
            Démarrer
          </div>
        </div>
      </div>
    </Link>
  )
}

function DomainTab({ domain, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-primary-dark text-white shadow-sm'
          : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/30'
      }`}
    >
      {domain.label}
      {domain.sub && <span className="ml-1 opacity-60 text-xs">· {domain.sub}</span>}
    </button>
  )
}

export default function ExercisesPage() {
  const [selectedDomain, setSelectedDomain] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exercisesApi.list(),
  })

  const allExercises = data?.results ?? data ?? []

  const filtered = allExercises.filter((ex) => {
    if (selectedDomain && ex.maladie !== selectedDomain) return false
    if (selectedDifficulty && ex.difficulte !== selectedDifficulty) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        ex.titre?.toLowerCase().includes(q) ||
        ex.maladie?.toLowerCase().includes(q) ||
        ex.description?.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Domain counts
  const counts = {}
  allExercises.forEach((ex) => {
    counts[ex.maladie] = (counts[ex.maladie] ?? 0) + 1
  })

  return (
    <div className="p-8 max-w-6xl mx-auto animate-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Exercices</h1>
        <p className="text-slate-500 text-sm">
          {allExercises.length} exercice{allExercises.length !== 1 ? 's' : ''} disponible{allExercises.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Domain stats */}
      <div className="grid grid-cols-3 lg:grid-cols-3 gap-4 mb-6">
        {DOMAINS.slice(1).map((d) => (
          <button
            key={d.value}
            onClick={() => setSelectedDomain(selectedDomain === d.value ? '' : d.value)}
            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
              selectedDomain === d.value
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
            }`}
          >
            <div className={`w-9 h-9 ${d.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <div className={`w-3 h-3 rounded-full ${d.dot}`} />
            </div>
            <div>
              <p className="text-xs text-slate-400">{d.sub}</p>
              <p className="font-heading font-semibold text-slate-900 text-sm">{d.label}</p>
              <p className={`text-xs font-medium ${d.color}`}>{counts[d.value] ?? 0} exercices</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un exercice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        {/* Domain filter pills */}
        <div className="flex gap-2 flex-wrap">
          {DOMAINS.map((d) => (
            <DomainTab
              key={d.value}
              domain={d}
              active={selectedDomain === d.value}
              onClick={() => setSelectedDomain(d.value)}
            />
          ))}
        </div>

        {/* Difficulty */}
        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value)}
          className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {isError && (
        <div className="text-center py-20">
          <p className="text-red-600 text-sm">Impossible de charger les exercices.</p>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <p className="text-slate-400 text-sm">Aucun exercice ne correspond à votre recherche.</p>
          <button
            onClick={() => { setSelectedDomain(''); setSelectedDifficulty(''); setSearch('') }}
            className="mt-3 text-sm text-primary font-medium hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))}
        </div>
      )}
    </div>
  )
}
