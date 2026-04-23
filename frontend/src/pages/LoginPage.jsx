import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import Button from '../components/Button'
import { IconGoogle, IconMicrosoft } from '../components/icons'

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Identifiants invalides. Vérifiez vos informations.')
    } finally {
      setLoading(false)
    }
  }

  function handleOAuth(provider) {
    window.location.href = `/api/auth/oauth/${provider}/`
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-primary px-12 py-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </div>
          <span className="font-heading font-bold text-white text-lg">MedTrain AI</span>
        </div>

        <div>
          <h1 className="font-heading text-4xl font-bold text-white leading-tight mb-4">
            Formez les médecins<br />de demain
          </h1>
          <p className="text-white/75 text-base leading-relaxed max-w-sm">
            Plateforme d'entraînement au diagnostic médical par image, assistée par intelligence artificielle.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { value: '3', label: 'Domaines médicaux' },
              { value: 'IA', label: 'Feedback en temps réel' },
              { value: '∞', label: 'Sessions illimitées' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-white/10 rounded-xl p-4">
                <p className="font-heading font-bold text-white text-2xl">{value}</p>
                <p className="text-white/65 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-xs">© 2025 MedTrain AI — Tous droits réservés</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="font-heading font-bold text-slate-900">MedTrain AI</span>
          </div>

          <h2 className="font-heading text-2xl font-bold text-slate-900 mb-1">Connexion</h2>
          <p className="text-slate-500 text-sm mb-7">Bienvenue ! Connectez-vous pour continuer.</p>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              onClick={() => handleOAuth('google')}
              className="flex items-center justify-center gap-3 w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <IconGoogle className="w-4 h-4" />
              Continuer avec Google
            </button>
            <button
              onClick={() => handleOAuth('microsoft')}
              className="flex items-center justify-center gap-3 w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <IconMicrosoft className="w-4 h-4" />
              Continuer avec Microsoft
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-slate-400">ou par e-mail</span>
            </div>
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Adresse e-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-slate-300"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3.5 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
              Se connecter
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            Pas encore de compte ?{' '}
            <span className="text-primary font-medium cursor-pointer hover:underline">
              Contactez votre établissement
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
