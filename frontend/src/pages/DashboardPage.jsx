import useAuthStore from '../store/authStore'
import StudentDashboard from './student/StudentDashboard'
import ProfDashboard from './prof/ProfDashboard'
import AdminDashboard from './admin/AdminDashboard'

export default function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role)

  if (role === 'prof') return <ProfDashboard />
  if (role === 'admin') return <AdminDashboard />
  return <StudentDashboard />
}
