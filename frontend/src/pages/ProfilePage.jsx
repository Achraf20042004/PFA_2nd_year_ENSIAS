import { useQuery }   from '@tanstack/react-query'
import { motion }     from 'framer-motion'
import { badgesApi }  from '../api/badges'
import { resultsApi } from '../api/results'
import { authApi }    from '../api/auth'
import LoadingSpinner from '../components/LoadingSpinner'
import useAuthStore   from '../store/authStore'
import { ROLE_LABELS } from '../styles/theme'
import { IconTrophy } from '../components/icons'
import ProfProfilePage from './prof/ProfProfilePage'

// ─── Domain config ────────────────────────────────────────────────────────────

const DOMAIN_INFO = {
  radiologie:   { label: 'Radiologie',   disease: 'Pneumonie',        icon: '🫁', hex: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100',   bar: 'bg-blue-500'    },
  dermatologie: { label: 'Dermatologie', disease: 'Mélanome',         icon: '🔬', hex: '#f97316', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-100', bar: 'bg-orange-500'  },
  neurologie:   { label: 'Neurologie',   disease: 'Tumeur cérébrale', icon: '🧠', hex: '#7c3aed', bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-100', bar: 'bg-violet-500'  },
}

const ALL_DOMAINS = ['radiologie', 'dermatologie', 'neurologie']

// ─── Tier system ──────────────────────────────────────────────────────────────

const TIERS = [
  { min: 0,    max: 10,   label: 'Débutant',      color: '#64748b', bg: 'bg-slate-100',   text: 'text-slate-600'   },
  { min: 10,   max: 100,  label: 'Praticien',     color: '#3b82f6', bg: 'bg-blue-100',    text: 'text-blue-700'    },
  { min: 100,  max: 300,  label: 'Diagnosticien', color: '#7c3aed', bg: 'bg-violet-100',  text: 'text-violet-700'  },
  { min: 300,  max: 500,  label: 'Expert',        color: '#d97706', bg: 'bg-amber-100',   text: 'text-amber-700'   },
  { min: 500,  max: 1000, label: 'Maître',        color: '#059669', bg: 'bg-emerald-100', text: 'text-emerald-700' },
]

function getTier(score) {
  if (score >= 1000) return { pct: 100, next: null, toNext: 0, ...TIERS[4] }
  const t = TIERS.find((t) => score < t.max) ?? TIERS[0]
  const pct = t.max === t.min ? 100 : Math.max(0, Math.round(((score - t.min) / (t.max - t.min)) * 100))
  return { pct, next: t.label, toNext: t.max - score, ...t }
}

// ─── Badge normalizer ─────────────────────────────────────────────────────────

function normalizeBadges(raw) {
  if (!raw) return { earned: [], available: [] }
  const earnedRaw    = Array.isArray(raw.earned)    ? raw.earned    : []
  const availableRaw = Array.isArray(raw.available) ? raw.available : []
  const earned = earnedRaw
    .map((item) => ({
      badge:    item?.badge && typeof item.badge === 'object' ? item.badge : item,
      earnedAt: item?.date_obtention ?? item?.date_obtained ?? null,
    }))
    .filter((x) => x.badge?.id != null)
  const earnedIds = new Set(earned.map((e) => e.badge.id))
  const available = availableRaw.filter((b) => b?.id != null && !earnedIds.has(b.id))
  return { earned, available }
}

// ─── SVG progress ring ────────────────────────────────────────────────────────

function ProgressRing({ pct, color, size = 64, stroke = 6 }) {
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const off  = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} className="rotate-[-90deg] shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: off }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  )
}

// ─── Domain card ──────────────────────────────────────────────────────────────

function DomainCard({ domainKey, entry, index }) {
  const info  = DOMAIN_INFO[domainKey]
  const score = entry?.score ?? 0
  const tier  = getTier(score)
  if (!info) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 + 0.15, duration: 0.35, ease: 'easeOut' }}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
    >
      {/* Colored top stripe */}
      <div className="h-1 w-full" style={{ background: info.hex }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${info.bg}`}>
            {info.icon}
          </span>
          <div className="min-w-0">
            <p className={`text-xs font-bold ${info.text}`}>{info.label}</p>
            <p className="text-[10px] text-slate-400 truncate">{info.disease}</p>
          </div>
          {entry?.badge && (
            <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${tier.bg} ${tier.text}`}>
              {entry.badge}
            </span>
          )}
        </div>

        {/* Ring + score */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <ProgressRing pct={tier.pct} color={info.hex} size={64} stroke={6} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-700 tabular-nums">{tier.pct}%</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-xl text-slate-900 leading-none">
              {score}<span className="text-xs font-normal text-slate-400 ml-1">pts</span>
            </p>
            <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
              {tier.label}
            </span>
            {tier.next && (
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                +{tier.toNext} → {tier.next}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Badge card ───────────────────────────────────────────────────────────────

function BadgeCard({ badge, earned, earnedAt }) {
  return (
    <motion.div
      whileHover={earned ? { y: -2, scale: 1.02 } : {}}
      transition={{ duration: 0.15 }}
      className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border text-center ${
        earned
          ? 'bg-white border-amber-100 shadow-sm cursor-default'
          : 'bg-slate-50 border-slate-100'
      }`}
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl leading-none ${
        earned ? 'bg-gradient-to-br from-amber-50 to-amber-100' : 'bg-slate-100 opacity-40'
      }`}>
        {badge?.icone_svg || '🏆'}
      </div>

      {/* Name */}
      <p className={`text-xs font-bold leading-tight line-clamp-2 ${
        earned ? 'text-slate-800' : 'text-slate-400'
      }`}>
        {badge?.nom ?? 'Badge'}
      </p>

      {/* Description */}
      {badge?.description && (
        <p className={`text-[10px] leading-tight line-clamp-2 ${
          earned ? 'text-slate-400' : 'text-slate-300'
        }`}>
          {badge.description}
        </p>
      )}

      {/* Status */}
      {earned ? (
        <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
          ✓ Obtenu
        </span>
      ) : (
        <span className="text-[9px] text-slate-300 font-medium">🔒 Verrouillé</span>
      )}
    </motion.div>
  )
}

// ─── Student profile ──────────────────────────────────────────────────────────

function StudentProfileContent() {
  const storeUser = useAuthStore((s) => s.user)

  const { data: freshUser }    = useQuery({ queryKey: ['auth', 'me'],       queryFn: authApi.me,        staleTime: 30_000 })
  const { data: history,       isLoading: histLoading }    = useQuery({ queryKey: ['results', 'me'],  queryFn: resultsApi.me })
  const { data: badgesRaw,     isLoading: badgesLoading }  = useQuery({ queryKey: ['badges', 'me'],   queryFn: badgesApi.me })
  const { data: domainScores,  isLoading: domainsLoading } = useQuery({
    queryKey: ['badges', 'domains'],
    queryFn:  badgesApi.domains,
    staleTime: 0,
    refetchOnMount: true,
  })

  const user = freshUser ?? storeUser
  const { earned, available } = normalizeBadges(badgesRaw)

  const initials    = (user?.first_name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name ?? ''}`.trim()
    : user?.email ?? 'Étudiant'

  const totalAttempts = history?.count ?? 0
  const avgRaw        = history?.average_score ?? null
  const avgScore      = avgRaw != null
    ? (avgRaw <= 1 ? Math.round(avgRaw * 100) : Math.round(avgRaw))
    : null

  const domainMap    = Object.fromEntries((domainScores ?? []).map((d) => [d.domain, d]))
  const hasDomains   = (domainScores?.length ?? 0) > 0

  return (
    <div className="min-h-screen bg-[#EEF5F1] pb-10 animate-page">
      <div className="max-w-4xl mx-auto px-4 pt-5 space-y-4">

        {/* ══ TOP ROW : profile (left) + badges (right) ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* ── PROFILE CARD ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-3xl shadow-md border border-slate-100"
        >
          {/* Cover — overflow-hidden only here for rounded corners + decorations */}
          <div className="h-36 rounded-t-3xl bg-gradient-to-br from-[#0a2e1a] via-[#1B5E3B] to-[#2d8a5c] overflow-hidden relative">
            {/* Dot matrix pattern */}
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
                backgroundSize: '20px 20px',
              }}
            />
            {/* Glow orbs */}
            <div className="absolute -top-10 -right-10 w-52 h-52 bg-[#4CAF82] opacity-20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-[#1B5E3B] opacity-30 rounded-full blur-2xl pointer-events-none" />

            {/* Role badge — top right of cover */}
            <div className="absolute top-4 right-4">
              <span className="text-[10px] font-bold bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3 py-1.5 rounded-full">
                {ROLE_LABELS[user?.role] ?? 'Étudiant'}
              </span>
            </div>
          </div>

          {/* Avatar — sibling of cover, inside the wrapper (not inside cover).
              top-24 = 96px = cover height(144) - avatar half(48).
              The wrapper is relative so this is anchored to the card. */}
          <div className="absolute left-6 top-24 z-10">
            <div
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#145233] to-[#4CAF82] shadow-2xl flex items-center justify-center"
              style={{ border: '4px solid white' }}
            >
              <span className="font-heading font-black text-white text-3xl select-none leading-none">
                {initials}
              </span>
            </div>
          </div>

          {/* White content — pt-16 (64px) clears the 48px avatar protrusion + breathing room */}
          <div className="bg-white rounded-b-3xl px-6 pt-16 pb-5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h2 className="font-heading font-bold text-slate-900 text-xl leading-tight">
                  {displayName}
                </h2>
                <p className="text-slate-400 text-sm mt-0.5 truncate">{user?.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {user?.etablissement && (
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                      🏫 {user.etablissement}
                    </span>
                  )}
                  {user?.date_joined && (
                    <span className="text-xs text-slate-400">
                      Membre depuis {new Date(user.date_joined).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats strip */}
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100">
              {histLoading ? (
                <div className="col-span-3 flex justify-center py-3"><LoadingSpinner /></div>
              ) : (
                <>
                  {[
                    { value: totalAttempts,              label: 'Sessions',    icon: '📊' },
                    { value: avgScore != null ? `${avgScore}%` : '—', label: 'Score moyen', icon: '🎯' },
                    { value: earned.length,              label: 'Badges',      icon: '🏅' },
                  ].map(({ value, label, icon }) => (
                    <div key={label} className="text-center py-2 px-1">
                      <p className="text-base mb-0.5">{icon}</p>
                      <p className="font-heading font-bold text-xl text-slate-900">{value}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{label}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── BADGES (right column) ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-heading font-semibold text-slate-900">Badges & Récompenses</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {badgesLoading
                  ? 'Chargement…'
                  : earned.length > 0
                    ? `${earned.length} obtenu${earned.length > 1 ? 's' : ''} · ${available.length} à débloquer`
                    : 'Complétez des exercices pour gagner des badges'}
              </p>
            </div>
            {earned.length > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold px-3 py-1.5 rounded-full shrink-0">
                <IconTrophy className="w-3.5 h-3.5" />
                {earned.length}
              </div>
            )}
          </div>

          {badgesLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : earned.length === 0 && available.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">
                🏆
              </div>
              <p className="text-sm font-semibold text-slate-400">Aucun badge pour l'instant</p>
              <p className="text-xs text-slate-300 mt-1">Terminez votre premier exercice pour débloquer des badges</p>
            </div>
          ) : (
            <div className="space-y-5">
              {earned.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">✨ Obtenus</span>
                    <div className="flex-1 h-px bg-amber-100" />
                    <span className="text-[10px] font-bold text-amber-500">{earned.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {earned.map(({ badge, earnedAt }) => (
                      <BadgeCard key={badge.id} badge={badge} earned earnedAt={earnedAt} />
                    ))}
                  </div>
                </div>
              )}
              {available.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">À débloquer</span>
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-[10px] font-bold text-slate-400">{available.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {available.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} earned={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        </div>{/* end top row grid */}

        {/* ══ DOMAIN PROGRESSION ══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading font-semibold text-slate-900">Progression par domaine</h2>
              <p className="text-xs text-slate-400 mt-0.5">Score cumulatif et palier par spécialité</p>
            </div>
          </div>

          {domainsLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : !hasDomains ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2">🩺</p>
              <p className="text-sm text-slate-400 font-medium">Aucune session enregistrée</p>
              <p className="text-xs text-slate-300 mt-1">Commencez un exercice pour voir votre progression</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ALL_DOMAINS.map((key, i) => (
                <DomainCard key={key} domainKey={key} entry={domainMap[key] ?? null} index={i} />
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  )
}

// ─── Root dispatcher ──────────────────────────────────────────────────────────

export default function ProfilePage() {
  const role = useAuthStore((s) => s.user?.role)
  if (role === 'prof') return <ProfProfilePage />
  return <StudentProfileContent />
}
