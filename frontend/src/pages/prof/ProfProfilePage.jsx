import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { analyticsApi } from '../../api/analytics'
import { authApi } from '../../api/auth'
import { datasetsApi } from '../../api/datasets'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'

// ─── Design tokens ──────────────────────────────────────────────────────────

const DOMAIN = {
  pneumonie: { label: 'Pneumonie',    bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-100' },
  melanome:  { label: 'Dermatologie', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-100' },
  tumeur:    { label: 'Neurologie',   bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', border: 'border-violet-100' },
}

const DATASET_STATUS = {
  ready:      { label: 'Prêt',         cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  processing: { label: 'Traitement…',  cls: 'bg-amber-50   text-amber-700   border border-amber-100'   },
  uploaded:   { label: 'Uploadé',      cls: 'bg-blue-50    text-blue-700    border border-blue-100'    },
  error:      { label: 'Erreur',       cls: 'bg-red-50     text-red-700     border border-red-100'     },
}

// ─── Count-up hook ───────────────────────────────────────────────────────────

function useCountUp(target, { duration = 1000, enabled = true } = {}) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!enabled || target == null || target === 0) { setValue(target ?? 0); return }
    const start = Date.now()
    const end = target
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * end))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, enabled])
  return value
}

// ─── Animation presets ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.09 } },
}

// ─── Recharts custom tooltip ─────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-xl shadow-xl">
      <p className="font-semibold mb-0.5">{label}</p>
      <p className="text-slate-300">{payload[0].value} tentative{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ icon, label, rawValue, suffix = '', textColor = 'text-primary', delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const animated = useCountUp(typeof rawValue === 'number' ? rawValue : 0, { enabled: inView })

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 group hover:shadow-md transition-shadow duration-300"
    >
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />

      <div className="w-10 h-10 bg-primary/8 rounded-xl flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>

      <div>
        {typeof rawValue === 'number' ? (
          <p className={`font-heading font-bold text-2xl ${textColor}`}>
            {animated}{suffix}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            {rawValue ? (
              <>
                <span className={`w-2.5 h-2.5 rounded-full ${DOMAIN[rawValue]?.dot ?? 'bg-slate-400'}`} />
                <p className={`font-heading font-bold text-lg ${DOMAIN[rawValue]?.text ?? 'text-slate-700'}`}>
                  {DOMAIN[rawValue]?.label ?? rawValue}
                </p>
              </>
            ) : (
              <p className="font-heading font-bold text-xl text-slate-300">—</p>
            )}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-0.5 font-medium">{label}</p>
      </div>
    </motion.div>
  )
}

// ─── Dataset row ─────────────────────────────────────────────────────────────

function DatasetRow({ dataset, index }) {
  const d = DOMAIN[dataset.maladie] ?? { label: dataset.maladie, bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-100' }
  const s = DATASET_STATUS[dataset.statut] ?? { label: dataset.statut, cls: 'bg-slate-100 text-slate-600 border border-slate-200' }
  const date = dataset.created_at ? new Date(dataset.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors"
    >
      {/* Rank */}
      <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-slate-400">{index + 1}</span>
      </div>

      {/* Domain dot + label */}
      <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${d.bg} border ${d.border} shrink-0`}>
        <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
        <span className={`text-xs font-semibold ${d.text}`}>{d.label}</span>
      </div>

      {/* Images count */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 font-medium">{dataset.nb_images} image{dataset.nb_images !== 1 ? 's' : ''}</p>
        <p className="text-xs text-slate-400 mt-0.5">{date}</p>
      </div>

      {/* Status badge */}
      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${s.cls}`}>
        {s.label}
      </span>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfProfilePage() {
  const storeUser = useAuthStore((s) => s.user)

  // Fresh profile from /auth/me/ (includes first_name, last_name, établissement)
  const { data: freshProfile } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    staleTime: 30_000,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['analytics', 'prof-profile-stats'],
    queryFn: analyticsApi.profProfileStats,
  })

  const user = freshProfile ?? storeUser

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name ?? ''}`.trim()
    : user?.email?.split('@')[0] ?? 'Professeur'

  const initials = (user?.first_name?.[0] ?? user?.email?.[0] ?? 'P').toUpperCase()

  const weekly = stats?.weekly_attempts ?? []
  const maxCount = Math.max(...weekly.map((w) => w.count), 1)

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">

      {/* ── Hero card ── */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="bg-white rounded-3xl border border-slate-100 shadow-sm mb-6 overflow-hidden"
      >
        {/* Cover */}
        <div className="h-28 bg-gradient-to-r from-[#1B5E3B] via-[#2E7D52] to-[#A8E6C3] relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        </div>

        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="-mt-12 mb-4 flex items-end justify-between">
            <div className="relative">
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-2xl bg-primary/25"
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1B5E3B] to-[#4CAF82] border-4 border-white shadow-lg flex items-center justify-center relative z-10">
                <span className="font-heading font-bold text-white text-2xl select-none">{initials}</span>
              </div>
            </div>

            {/* Edit button */}
            <button className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
              Modifier le profil
            </button>
          </div>

          {/* Info */}
          <h2 className="font-heading font-bold text-slate-900 text-2xl leading-tight">{displayName}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{user?.email}</p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
              Professeur
            </span>
            {user?.etablissement && (
              <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                </svg>
                {user.etablissement}
              </span>
            )}
            {user?.date_joined && (
              <span className="text-xs text-slate-400 font-medium">
                Membre depuis {new Date(user.date_joined).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {statsLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="space-y-6">

          {/* ── Teaching stats ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-heading font-semibold text-slate-900 text-lg">Mes Statistiques d'Enseignement</h2>
            </div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
            >
              <StatCard
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                }
                label="Datasets créés"
                rawValue={stats?.total_datasets ?? 0}
              />
              <StatCard
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                }
                label="Étudiants actifs"
                rawValue={stats?.total_students ?? 0}
              />
              <StatCard
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                  </svg>
                }
                label="Tentatives générées"
                rawValue={stats?.total_attempts ?? 0}
              />
              <StatCard
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                }
                label="Score moyen global"
                rawValue={stats?.avg_score ?? 0}
                suffix="%"
                textColor={
                  stats?.avg_score == null ? 'text-slate-300'
                  : stats.avg_score >= 80 ? 'text-emerald-600'
                  : stats.avg_score >= 60 ? 'text-amber-600'
                  : 'text-red-500'
                }
              />
              <StatCard
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
                  </svg>
                }
                label="Domaine le plus actif"
                rawValue={stats?.top_domain ?? null}
              />
            </motion.div>
          </div>

          {/* ── Activity chart ── */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="px-6 pt-5 pb-3 flex items-start justify-between">
              <div>
                <h3 className="font-heading font-semibold text-slate-900 text-base">Activité — tentatives étudiants</h3>
                <p className="text-xs text-slate-400 mt-0.5">Évolution sur les 8 dernières semaines</p>
              </div>
              {stats?.total_attempts > 0 && (
                <div className="flex items-center gap-1.5 bg-primary/8 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {stats.total_attempts} au total
                </div>
              )}
            </div>

            {weekly.length > 0 && maxCount > 0 ? (
              <div className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={weekly} margin={{ top: 8, right: 16, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1B5E3B" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#1B5E3B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#1B5E3B', strokeWidth: 1, strokeDasharray: '4 2' }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#1B5E3B"
                      strokeWidth={2}
                      fill="url(#areaGrad)"
                      dot={{ r: 3, fill: '#1B5E3B', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#1B5E3B', strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="px-6 pb-8 pt-4 text-center">
                <p className="text-sm text-slate-400">Aucune tentative cette semaine.</p>
                <p className="text-xs text-slate-300 mt-1">Les données apparaîtront après les premières sessions étudiantes.</p>
              </div>
            )}
          </motion.div>

          {/* ── Recent datasets ── */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-slate-900 text-base">Mes datasets récents</h3>
                <p className="text-xs text-slate-400 mt-0.5">{stats?.total_datasets ?? 0} dataset{(stats?.total_datasets ?? 0) !== 1 ? 's' : ''} au total</p>
              </div>
              <a
                href="/datasets/upload"
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Nouveau dataset
              </a>
            </div>

            {(stats?.recent_datasets ?? []).length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400 font-medium">Aucun dataset créé</p>
                <p className="text-xs text-slate-300 mt-1">Uploadez votre premier dataset pour commencer.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {stats.recent_datasets.map((ds, i) => (
                  <DatasetRow key={ds.id} dataset={ds} index={i} />
                ))}
              </div>
            )}
          </motion.div>

        </div>
      )}
    </div>
  )
}
