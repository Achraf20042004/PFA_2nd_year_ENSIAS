import { useEffect, useState } from 'react'
import { createBrowserRouter, Navigate, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import AppLayout from './components/AppLayout'
import LoadingSpinner from './components/LoadingSpinner'

// Auth
import LoginPage from './pages/LoginPage'

// Role dashboards
import StudentDashboard from './pages/student/StudentDashboard'
import ProfDashboard from './pages/prof/ProfDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

// Shared
import ProfilePage from './pages/ProfilePage'

// Student
import ExercisesPage from './pages/ExercisesPage'
import ExercisePage from './pages/ExercisePage'
import FeedbackPage from './pages/FeedbackPage'
import ExamsPage from './pages/student/ExamsPage'
import HistoryPage from './pages/student/HistoryPage'

// Prof
import MyExercisesPage from './pages/prof/MyExercisesPage'
import UploadDatasetPage from './pages/prof/UploadDatasetPage'
import ProfAnalyticsPage from './pages/prof/ProfAnalyticsPage'

// Admin
import UsersPage from './pages/admin/UsersPage'
import ETLLogsPage from './pages/admin/ETLLogsPage'
import ModelMetricsPage from './pages/admin/ModelMetricsPage'

// ─── Helpers ──────────────────────────────────────────────────────────────

function dashboardPathForRole(role) {
  if (role === 'prof') return '/prof/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  return '/student/dashboard'
}

// ─── Guards ────────────────────────────────────────────────────────────────

function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)
  if (!accessToken) return <Navigate to="/login" replace />
  return <Outlet />
}

function GuestRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const role = useAuthStore((s) => s.user?.role)
  if (accessToken) return <Navigate to={dashboardPathForRole(role)} replace />
  return <Outlet />
}

/**
 * RoleRoute — renders children only if the user's role is in `allowed`.
 * Any other role is redirected to their own dashboard.
 */
function RoleRoute({ allowed }) {
  const role = useAuthStore((s) => s.user?.role)
  if (!allowed.includes(role)) return <Navigate to={dashboardPathForRole(role)} replace />
  return <Outlet />
}

/**
 * RootRedirect — resolves "/" to the correct dashboard for the signed-in user.
 * If role is not yet in the store (e.g. first load after OAuth), it calls
 * /api/auth/me/ once to hydrate the user, then redirects.
 */
function RootRedirect() {
  const role = useAuthStore((s) => s.user?.role)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const [loading, setLoading] = useState(!role)

  useEffect(() => {
    if (role) return          // already know the role, skip the fetch
    fetchMe().finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return <Navigate to={dashboardPathForRole(role)} replace />
}

// ─── Router ───────────────────────────────────────────────────────────────

const router = createBrowserRouter([
  // Public
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },

  // Protected
  {
    element: <ProtectedRoute />,
    children: [
      // "/" resolves to the correct dashboard for each role
      { path: '/', element: <RootRedirect /> },

      // Sidebar layout
      {
        element: <AppLayout />,
        children: [
          // ── Student dashboard ──────────────────────────────────────────
          {
            element: <RoleRoute allowed={['etudiant']} />,
            children: [
              { path: '/student/dashboard', element: <StudentDashboard /> },
              { path: '/exams', element: <ExamsPage /> },
              { path: '/history', element: <HistoryPage /> },
            ],
          },

          // ── Prof dashboard ─────────────────────────────────────────────
          {
            element: <RoleRoute allowed={['prof']} />,
            children: [
              { path: '/prof/dashboard', element: <ProfDashboard /> },
              { path: '/my-exercises', element: <MyExercisesPage /> },
              { path: '/datasets/upload', element: <UploadDatasetPage /> },
              { path: '/analytics', element: <ProfAnalyticsPage /> },
            ],
          },

          // ── Admin dashboard ────────────────────────────────────────────
          {
            element: <RoleRoute allowed={['admin']} />,
            children: [
              { path: '/admin/dashboard', element: <AdminDashboard /> },
              { path: '/users', element: <UsersPage /> },
              { path: '/etl-logs', element: <ETLLogsPage /> },
              { path: '/model-metrics', element: <ModelMetricsPage /> },
            ],
          },

          // ── Shared (all authenticated roles) ──────────────────────────
          { path: '/exercises', element: <ExercisesPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },

      // Full-screen pages (no sidebar)
      { path: '/exercises/:id', element: <ExercisePage /> },
      { path: '/exercises/:id/feedback/:attemptId', element: <FeedbackPage /> },
    ],
  },

  // Fallback → role-aware redirect via "/"
  { path: '*', element: <Navigate to="/" replace /> },
])

export default router
