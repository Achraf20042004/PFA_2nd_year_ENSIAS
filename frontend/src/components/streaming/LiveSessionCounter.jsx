import { useEffect, useRef, useState } from 'react'

function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef(null)

  useEffect(() => {
    const from = prevRef.current
    if (from === target) return
    prevRef.current = target

    const startTime = performance.now()
    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - (1 - t) ** 3  // ease-out cubic
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}

export default function LiveSessionCounter({ count = 0 }) {
  const display = useCountUp(count)

  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-4"
      style={{ background: '#1a1d2e', border: '1px solid #2d2f45' }}
    >
      <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>
        Sessions actives
      </p>

      <div className="flex items-center gap-3">
        {/* Pulsing green dot */}
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
        </span>

        <span
          className="text-5xl font-bold tabular-nums"
          style={{ color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}
        >
          {display}
        </span>
      </div>

      <p className="text-xs" style={{ color: '#94a3b8' }}>
        15 dernières minutes
      </p>
    </div>
  )
}
