import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import {
  IconHome, IconBook, IconChart, IconTrophy,
  IconDatabase, IconAnalytics, IconUser, IconLogout, IconStar, IconClock, IconCourse,
} from './icons'

// ─── Nav definitions per role ─────────────────────────────────────────────

const STUDENT_NAV = [
  { to: '/student/dashboard', label: 'Tableau de bord', icon: IconHome, end: true },
  { to: '/exercises', label: 'Exercices', icon: IconBook },
  { to: '/exams', label: 'Examens', icon: IconStar },
  { to: '/history', label: 'Historique', icon: IconClock },
  { to: '/profile', label: 'Mon profil', icon: IconUser },
]

const PROF_NAV = [
  { to: '/prof/dashboard', label: 'Tableau de bord', icon: IconHome, end: true },
  { to: '/my-exercises', label: 'Mes exercices', icon: IconBook },
  { to: '/datasets/upload', label: 'Upload dataset', icon: IconDatabase },
  { to: '/analytics', label: 'Analytics', icon: IconAnalytics },
  { to: '/profile', label: 'Mon profil', icon: IconUser },
]

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Tableau de bord', icon: IconHome, end: true },
  { to: '/users', label: 'Utilisateurs', icon: IconUser },
  { to: '/etl-logs', label: 'Logs ETL', icon: IconChart },
  { to: '/model-metrics', label: 'Métriques IA', icon: IconAnalytics },
  { to: '/analytics', label: 'Analytics', icon: IconDatabase },
  { to: '/profile', label: 'Mon profil', icon: IconCourse },
]

const NAV_BY_ROLE = {
  etudiant: STUDENT_NAV,
  prof: PROF_NAV,
  admin: ADMIN_NAV,
}

const ROLE_LABELS = {
  admin: 'Administrateur',
  prof: 'Professeur',
  etudiant: 'Étudiant',
}

const ROLE_BADGE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  prof: 'bg-violet-100 text-violet-700',
  etudiant: 'bg-primary/10 text-primary',
}

// ─── NavItem ──────────────────────────────────────────────────────────────

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
          {label}
        </>
      )}
    </NavLink>
  )
}

// ─── AppLayout ────────────────────────────────────────────────────────────

export default function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const role = user?.role ?? 'etudiant'
  const navItems = NAV_BY_ROLE[role] ?? STUDENT_NAV

  const initials = (user?.first_name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name ?? ''}`.trim()
    : user?.email ?? 'Utilisateur'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-100 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <div>
              <span className="font-heading font-bold text-slate-900 text-sm leading-none block">MedTrain AI</span>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md mt-0.5 inline-block ${ROLE_BADGE_COLORS[role]}`}>
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-slate-100 space-y-1">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive ? 'bg-primary/10' : 'hover:bg-slate-100'
              }`
            }
          >
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="overflow-hidden flex-1">
              <p className="font-medium text-slate-800 truncate text-xs leading-tight">{displayName}</p>
              <p className="text-slate-400 text-xs">{user?.etablissement ?? ROLE_LABELS[role]}</p>
            </div>
          </NavLink>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <IconLogout className="w-4 h-4 shrink-0" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
