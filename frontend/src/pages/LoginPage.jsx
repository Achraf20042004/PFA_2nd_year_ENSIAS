import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import Button from '../components/Button'
import { IconGoogle, IconMicrosoft } from '../components/icons'

// ─── Left panel decorative SVG ────────────────────────────────────────────

function MedicalPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.06]"
      viewBox="0 0 500 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* DNA / helix dots */}
      {Array.from({ length: 8 }).map((_, i) => (
        <g key={i}>
          <circle cx={80 + i * 50} cy={40 + i * 68} r="4" fill="white" />
          <circle cx={420 - i * 50} cy={60 + i * 68} r="4" fill="white" />
          <line
            x1={80 + i * 50} y1={40 + i * 68}
            x2={420 - i * 50} y2={60 + i * 68}
            stroke="white" strokeWidth="1"
          />
        </g>
      ))}
      {/* Medical cross — top right */}
      <rect x="390" y="30" width="12" height="40" rx="3" fill="white" />
      <rect x="375" y="45" width="40" height="12" rx="3" fill="white" />
      {/* Stethoscope circle — bottom left */}
      <circle cx="70" cy="520" r="35" stroke="white" strokeWidth="5" />
      <path d="M70 485 Q70 440 110 430" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Heartbeat line */}
      <polyline
        points="30,300 80,300 100,260 120,340 140,300 200,300 220,280 240,320 260,300 340,300"
        stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </svg>
  )
}

// ─── Feature stat card ────────────────────────────────────────────────────

function FeatureStat({ value, label }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
      <p className="font-heading font-bold text-white text-2xl">{value}</p>
      <p className="text-white/60 text-xs mt-1 leading-snug">{label}</p>
    </div>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────

function FormInput({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl
          placeholder:text-slate-300 text-slate-800
          focus:ring-2 focus:ring-primary/30 focus:border-primary/60
          transition-all duration-200"
      />
    </div>
  )
}

// ─── OAuth button ─────────────────────────────────────────────────────────

function OAuthButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-3 w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700
        hover:border-primary/40 hover:bg-primary-light transition-all duration-200 group"
    >
      <Icon className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
      {label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────

export default function LoginPage() {
  const login    = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

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

      {/* ── Left panel — brand (desktop only) ── */}
      <div className="hidden lg:flex relative flex-col justify-between w-[44%] bg-primary-dark overflow-hidden px-12 py-10">
        <MedicalPattern />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center border border-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </div>
          <span className="font-heading font-bold text-white text-lg">MedTrain AI</span>
        </div>

        {/* Main content */}
        <div className="relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-mint animate-pulse" />
            <span className="text-white/80 text-xs font-medium">Plateforme médicale IA</span>
          </div>

          <h1 className="font-heading text-4xl font-bold text-white leading-tight mb-4">
            Formez les<br />
            <span className="text-mint">médecins</span><br />
            de demain
          </h1>
          <p className="text-white/65 text-sm leading-relaxed max-w-xs">
            Entraînez-vous au diagnostic médical sur des images réelles, guidé par l'intelligence artificielle.
          </p>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            <FeatureStat value="3" label="Domaines médicaux" />
            <FeatureStat value="IA" label="Feedback en temps réel" />
            <FeatureStat value="∞" label="Sessions illimitées" />
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-white/30 text-xs">© 2025 MedTrain AI</p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-[#F7FFFE]">
        <div className="w-full max-w-sm animate-page">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </div>
            <span className="font-heading font-bold text-slate-900">MedTrain AI</span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="font-heading text-2xl font-bold text-slate-900 mb-1">Connexion</h2>
            <p className="text-slate-400 text-sm">Bienvenue ! Connectez-vous pour continuer.</p>
          </div>

          {/* OAuth */}
          <div className="space-y-3 mb-6">
            <OAuthButton icon={IconGoogle}    label="Continuer avec Google"    onClick={() => handleOAuth('google')} />
            <OAuthButton icon={IconMicrosoft} label="Continuer avec Microsoft" onClick={() => handleOAuth('microsoft')} />
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#F7FFFE] px-3 text-xs text-slate-400 font-medium">ou par e-mail</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Adresse e-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              autoComplete="email"
            />
            <FormInput
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-red-700 leading-snug">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full mt-1" size="lg">
              Se connecter
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            Pas encore de compte ?{' '}
            <span className="text-primary-dark font-semibold cursor-pointer hover:underline">
              Contactez votre établissement
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
