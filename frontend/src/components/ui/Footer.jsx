export default function Footer() {
  return (
    <footer className="shrink-0 bg-[#1B5E3B]" style={{ height: 44 }}>
      <div className="h-full border-t border-white/10 flex items-center justify-between px-6 gap-4">

        {/* Left — logo + name */}
        <div className="flex items-center gap-2 shrink-0">
          <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
          <span className="text-white/80 text-[11px] font-semibold tracking-wide">MedTrain AI</span>
        </div>

        {/* Center — copyright */}
        <p className="text-white/35 text-[11px] text-center hidden sm:block">
          © 2025 MedTrain AI — Projet de Fin d'Année
        </p>

        {/* Right — domains */}
        <p className="text-white/30 text-[11px] shrink-0 hidden md:block">
          Pneumonie · Dermatologie · Neurologie
        </p>

      </div>
    </footer>
  )
}
