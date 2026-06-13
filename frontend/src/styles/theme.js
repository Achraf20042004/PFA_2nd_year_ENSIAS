// Centralized design tokens — import these instead of repeating Tailwind classes

export const DOMAIN_META = {
  pneumonie: {
    label: 'Pneumonie',
    sublabel: 'Pneumonie · Radiologie',
    domain: 'radiologie',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    bar: 'bg-blue-500',
    border: 'border-blue-100',
    ring: 'ring-blue-200',
  },
  melanome: {
    label: 'Dermatologie',
    sublabel: 'Dermatologie · Mélanome',
    domain: 'dermatologie',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    border: 'border-orange-100',
    ring: 'ring-orange-200',
  },
  tumeur: {
    label: 'Neurologie',
    sublabel: 'Neurologie · Tumeur cérébrale',
    domain: 'neurologie',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    bar: 'bg-violet-500',
    border: 'border-violet-100',
    ring: 'ring-violet-200',
  },
}

export const DOMAIN_BY_KEY = {
  radiologie: DOMAIN_META.pneumonie,
  dermatologie: DOMAIN_META.melanome,
  neurologie: DOMAIN_META.tumeur,
}

export const BADGE_COLORS = {
  'Débutant':      'bg-slate-100 text-slate-600',
  'Praticien':     'bg-blue-100 text-blue-700',
  'Diagnosticien': 'bg-violet-100 text-violet-700',
  'Expert':        'bg-amber-100 text-amber-700',
  'Maître':        'bg-emerald-100 text-emerald-700',
}

export const DIFFICULTY_COLORS = {
  facile:    'bg-emerald-100 text-emerald-700',
  moyen:     'bg-amber-100 text-amber-700',
  difficile: 'bg-red-100 text-red-700',
}

export const ROLE_LABELS = {
  admin: 'Administrateur',
  prof: 'Professeur',
  etudiant: 'Étudiant',
}
