import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function Navbar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="font-heading text-xl font-bold text-primary">
        MedTrain AI
      </Link>

      <div className="flex items-center gap-6">
        <Link to="/exercises" className="text-sm text-slate-600 hover:text-primary transition-colors">
          Exercices
        </Link>
        <Link to="/profile" className="text-sm text-slate-600 hover:text-primary transition-colors">
          {user?.email ?? 'Profil'}
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-500 hover:text-red-500 transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  )
}
