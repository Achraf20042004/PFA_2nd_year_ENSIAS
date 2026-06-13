import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useAuthStore from '../store/authStore'
import {
  IconHome, IconBook, IconChart, IconDatabase, IconAnalytics,
  IconUser, IconLogout, IconStar, IconClock, IconSignal, IconChevronRight,
} from './icons'
import Footer from './ui/Footer'

// ─── Constants ────────────────────────────────────────────────────────────────

const W_OPEN = 220
const W_SHUT = 64

// ─── Nav config ───────────────────────────────────────────────────────────────

const STUDENT_NAV = [
  { to: '/student/dashboard', label: 'Tableau de bord', icon: IconHome,      end: true },
  { to: '/exercises',         label: 'Exercices',        icon: IconBook               },
  { to: '/exams',             label: 'Examens',          icon: IconStar               },
  { to: '/history',           label: 'Historique',       icon: IconClock              },
  { to: '/profile',           label: 'Mon profil',       icon: IconUser               },
]

const PROF_NAV = [
  { to: '/prof/dashboard',      label: 'Tableau de bord', icon: IconHome,      end: true },
  { to: '/my-exercises',        label: 'Mes exercices',   icon: IconBook               },
  { to: '/datasets/upload',     label: 'Upload dataset',  icon: IconDatabase           },
  { to: '/analytics',           label: 'Analytics',       icon: IconAnalytics          },
  { to: '/dashboard/streaming', label: 'Temps Réel',      icon: IconSignal             },
  { to: '/profile',             label: 'Mon profil',      icon: IconUser               },
]

const ADMIN_NAV = [
  { to: '/admin/dashboard',     label: 'Tableau de bord', icon: IconHome,      end: true },
  { to: '/users',               label: 'Utilisateurs',    icon: IconUser               },
  { to: '/etl-logs',            label: 'Logs ETL',        icon: IconChart              },
  { to: '/model-metrics',       label: 'Métriques IA',    icon: IconAnalytics          },
  { to: '/dashboard/streaming', label: 'Temps Réel',      icon: IconSignal             },
  { to: '/profile',             label: 'Mon profil',      icon: IconDatabase           },
]

const NAV_BY_ROLE = { etudiant: STUDENT_NAV, prof: PROF_NAV, admin: ADMIN_NAV }

const ROLE_META = {
  admin:    { label: 'Administrateur', pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  prof:     { label: 'Professeur',     pill: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  etudiant: { label: 'Étudiant',       pill: 'bg-violet-100 text-violet-700',   dot: 'bg-violet-500'  },
}

// Page title map for breadcrumb
const PAGE_TITLES = {
  '/student/dashboard': 'Tableau de bord',
  '/prof/dashboard':    'Tableau de bord',
  '/admin/dashboard':   'Tableau de bord',
  '/exercises':         'Exercices',
  '/exams':             'Examens',
  '/history':           'Historique',
  '/profile':           'Mon profil',
  '/my-exercises':      'Mes exercices',
  '/datasets/upload':   'Upload dataset',
  '/analytics':         'Analytics',
  '/dashboard/streaming': 'Temps Réel',
  '/users':             'Utilisateurs',
  '/etl-logs':          'Logs ETL',
  '/model-metrics':     'Métriques IA',
}

function usePageTitle(navItems) {
  const { pathname } = useLocation()
  const exact = PAGE_TITLES[pathname]
  if (exact) return exact
  const match = navItems.find((n) => pathname.startsWith(n.to) && n.to !== '/')
  return match?.label ?? 'MedTrain AI'
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = time.getHours().toString().padStart(2, '0')
  const mm = time.getMinutes().toString().padStart(2, '0')
  const ss = time.getSeconds().toString().padStart(2, '0')
  const date = time.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <div className="hidden lg:flex flex-col items-end leading-none select-none">
      <span className="font-mono text-sm font-semibold text-white/90 tracking-widest">
        {hh}<span className="text-white/30 animate-pulse">:</span>{mm}
        <span className="text-[10px] text-white/40 ml-0.5">{ss}</span>
      </span>
      <span className="text-[10px] text-white/40 mt-0.5 capitalize">{date}</span>
    </div>
  )
}

// ─── Notification bell ────────────────────────────────────────────────────────

function NotifBell() {
  const [open, setOpen] = useState(false)

  const notifs = [
    { id: 1, icon: '🏆', text: 'Nouveau badge débloqué !',         time: 'À l\'instant',  unread: true  },
    { id: 2, icon: '📊', text: 'Vos résultats ont été enregistrés', time: 'Il y a 2 min', unread: true  },
    { id: 3, icon: '📚', text: 'Nouvel exercice disponible',        time: 'Il y a 1h',    unread: false },
  ]
  const unread = notifs.filter((n) => n.unread).length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-[#1B5E3B]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Notifications</span>
                {unread > 0 && (
                  <span className="text-[11px] bg-red-50 text-red-500 font-semibold px-2 py-0.5 rounded-full">
                    {unread} non lues
                  </span>
                )}
              </div>
              <div className="py-1">
                {notifs.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${n.unread ? 'bg-blue-50/40' : ''}`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{n.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${n.unread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                        {n.text}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{n.time}</p>
                    </div>
                    {n.unread && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                <button className="text-xs text-primary font-semibold hover:underline">
                  Tout marquer comme lu
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── NavItem (sidebar) ────────────────────────────────────────────────────────

function NavItem({ to, label, icon: Icon, end, shut, onClick }) {
  return (
    <div className="relative group/nav">
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        className={({ isActive }) =>
          `relative flex items-center rounded-xl text-sm font-medium transition-all duration-150
           ${shut ? 'justify-center w-10 h-10 mx-auto p-0' : 'gap-3 pl-4 pr-3 py-2.5'}
           ${isActive
             ? 'bg-[#1B5E3B] text-white shadow-md shadow-[#1B5E3B]/25'
             : 'text-[#2D5A3D] hover:bg-white/50 hover:text-[#1B5E3B]'
           }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors
                ${isActive ? 'text-white' : 'text-[#4A8C64] group-hover/nav:text-[#1B5E3B]'}`}
            />
            <AnimatePresence initial={false}>
              {!shut && (
                <motion.span
                  key="lbl"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15, ease: 'easeInOut' }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </>
        )}
      </NavLink>

      {shut && (
        <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1B5E3B] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
          {label}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1B5E3B]" />
        </span>
      )}
    </div>
  )
}

// ─── Sidebar body ─────────────────────────────────────────────────────────────

function SidebarBody({ shut, toggleShut, navItems, roleMeta, initials, displayName, user, onClose, onLogout }) {
  const isDrawer = !!onClose

  return (
    <div className="flex flex-col h-full">

      {/* ── Navigation ── */}
      <nav className={`flex-1 overflow-y-auto py-3 ${shut && !isDrawer ? 'px-1.5 space-y-1' : 'px-3 space-y-0.5'}`}>
        {(!shut || isDrawer) && (
          <p className="px-3 pt-1 pb-2 text-[10px] font-semibold tracking-widest text-[#4A8C64]/60 uppercase select-none">
            Navigation
          </p>
        )}
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            shut={shut && !isDrawer}
            onClick={onClose ?? undefined}
          />
        ))}
      </nav>

      {/* ── User footer ── */}
      <div className={`border-t border-[#B8D9C5]/60 py-2 ${shut && !isDrawer ? 'px-1.5 space-y-1' : 'px-3 space-y-0.5'}`}>
        {/* Profile link */}
        <div className="relative group/nav">
          <NavLink
            to="/profile"
            onClick={onClose ?? undefined}
            className={({ isActive }) =>
              `flex items-center rounded-xl transition-all duration-150 py-2
               ${shut && !isDrawer ? 'justify-center w-10 h-10 mx-auto p-0' : 'gap-3 px-3'}
               ${isActive ? 'bg-[#1B5E3B] shadow-md shadow-[#1B5E3B]/25' : 'hover:bg-white/50'}`
            }
          >
            {({ isActive }) => (<>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white text-xs font-bold select-none">{initials}</span>
              </div>
              <AnimatePresence initial={false}>
                {(!shut || isDrawer) && (
                  <motion.div
                    key="user-text"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15, ease: 'easeInOut' }}
                    className="overflow-hidden flex-1 min-w-0"
                  >
                    <p className={`font-semibold truncate text-xs leading-tight ${isActive ? 'text-white' : 'text-[#2D5A3D]'}`}>{displayName}</p>
                    <p className={`text-[11px] truncate mt-0.5 ${isActive ? 'text-white/70' : 'text-[#4A8C64]/70'}`}>{user?.etablissement || user?.email || roleMeta.label}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>)}
          </NavLink>
          {shut && !isDrawer && (
            <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1B5E3B] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
              Mon profil
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1B5E3B]" />
            </span>
          )}
        </div>

        {/* Logout */}
        <div className="relative group/nav">
          <button
            onClick={onLogout}
            className={`w-full flex items-center rounded-xl text-sm text-[#4A8C64]/70 hover:bg-red-500/10 hover:text-red-600 transition-all duration-150 py-2
              ${shut && !isDrawer ? 'justify-center w-10 h-10 mx-auto p-0' : 'gap-3 px-3'}`}
          >
            <IconLogout className="w-4 h-4 shrink-0" />
            <AnimatePresence initial={false}>
              {(!shut || isDrawer) && (
                <motion.span
                  key="logout-lbl"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15, ease: 'easeInOut' }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Déconnexion
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          {shut && !isDrawer && (
            <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1B5E3B] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
              Déconnexion
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1B5E3B]" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const user    = useAuthStore((s) => s.user)
  const logout  = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const [shut, setShut] = useState(() => {
    try { return localStorage.getItem('sidebar-shut') === 'true' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const role        = user?.role ?? 'etudiant'
  const navItems    = NAV_BY_ROLE[role] ?? STUDENT_NAV
  const roleMeta    = ROLE_META[role] ?? ROLE_META.etudiant
  const initials    = (user?.first_name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name ?? ''}`.trim()
    : user?.email ?? 'Utilisateur'

  const pageTitle = usePageTitle(navItems)

  function handleLogout() { logout(); navigate('/login') }

  function toggleShut() {
    setShut((c) => {
      const next = !c
      try { localStorage.setItem('sidebar-shut', String(next)) } catch {}
      return next
    })
  }

  const sidebarProps = { navItems, roleMeta, initials, displayName, user, onLogout: handleLogout }

  return (
    <div className="flex flex-col h-screen bg-[#F7FFFE]">

      {/* ══════════════════════════════════════════════════════
          TOP NAVBAR
      ══════════════════════════════════════════════════════ */}
      <header className="shrink-0 z-30 bg-gradient-to-r from-[#1B5E3B] via-[#1e6b43] to-[#145233] shadow-md">
        <div className="flex items-center px-4 gap-3" style={{ height: 52 }}>

          {/* Logo mark */}
          <div className="flex items-center gap-2.5 shrink-0 mr-1">
            <div className="w-7 h-7 bg-white/15 backdrop-blur rounded-lg flex items-center justify-center ring-1 ring-white/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="font-heading font-bold text-white text-sm hidden sm:block tracking-tight">MedTrain AI</span>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0"
            aria-label="Ouvrir le menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Collapse toggle — desktop */}
          <motion.button
            onClick={toggleShut}
            animate={{ rotate: shut ? 0 : 180 }}
            transition={{ duration: 0.2 }}
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title={shut ? 'Développer la sidebar' : 'Réduire la sidebar'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h7.5" />
            </svg>
          </motion.button>

          {/* Separator */}
          <div className="hidden md:block h-5 w-px bg-white/15 shrink-0" />

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-white/50 text-sm hidden sm:block">MedTrain</span>
            <svg className="w-3.5 h-3.5 text-white/30 hidden sm:block shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <AnimatePresence mode="wait">
              <motion.span
                key={pageTitle}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="text-sm font-semibold text-white truncate"
              >
                {pageTitle}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* ── Right side ── */}
          <div className="ml-auto flex items-center gap-2 shrink-0">

            {/* Search bar */}
            <div className="hidden lg:flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl px-3 py-1.5 cursor-text transition-colors group w-44">
              <svg className="w-3.5 h-3.5 text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <span className="text-xs text-white/40 flex-1">Rechercher…</span>
              <kbd className="text-[10px] font-mono text-white/30 bg-white/10 border border-white/10 px-1.5 py-0.5 rounded-md">⌘K</kbd>
            </div>

            {/* Status dot — system online */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 rounded-lg border border-white/15">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
              </span>
              <span className="text-[11px] font-semibold text-white/80 whitespace-nowrap">Système actif</span>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-white/15 hidden sm:block" />

            {/* Live clock */}
            <LiveClock />

            {/* Separator */}
            <div className="h-5 w-px bg-white/15 hidden lg:block" />

            {/* Notifications */}
            <NotifBell />

            {/* Separator */}
            <div className="h-5 w-px bg-white/15" />

            {/* Role badge + avatar */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/15 text-white/90 hidden sm:block border border-white/10">
                {roleMeta.label}
              </span>
              <NavLink to="/profile" className="shrink-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all">
                  <span className="text-white text-xs font-bold select-none">{initials}</span>
                </div>
              </NavLink>
            </div>

          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          BODY (sidebar + content)
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar ── */}
        <motion.aside
          animate={{ width: shut ? W_SHUT : W_OPEN }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="hidden md:flex flex-col shrink-0 bg-[#D6EDE1] border-r border-[#B8D9C5] z-20 h-full"
          style={{ minWidth: shut ? W_SHUT : W_OPEN }}
        >
          <SidebarBody {...sidebarProps} shut={shut} toggleShut={toggleShut} onClose={null} />
        </motion.aside>

        {/* ── Mobile: backdrop ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/40 z-30"
              onClick={() => setMobileOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Mobile: drawer ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.aside
              key="drawer"
              initial={{ x: -W_OPEN }}
              animate={{ x: 0 }}
              exit={{ x: -W_OPEN }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              className="md:hidden fixed inset-y-0 left-0 z-40 bg-[#D6EDE1] border-r border-[#B8D9C5]"
              style={{ width: W_OPEN }}
            >
              {/* Drawer header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-heading font-bold text-[#1B5E3B] text-sm leading-tight">MedTrain AI</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1B5E3B]/10 text-[#1B5E3B]`}>
                      {roleMeta.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4A8C64] hover:bg-white/50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <SidebarBody {...sidebarProps} shut={false} toggleShut={toggleShut} onClose={() => setMobileOpen(false)} />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          <div className="flex-1">
            <Outlet />
          </div>
          <Footer />
        </main>

      </div>
    </div>
  )
}
