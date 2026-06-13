// MinIO URL construction — override via VITE_MINIO_URL / VITE_MINIO_BUCKET env vars
const MINIO_BASE = import.meta.env.VITE_MINIO_URL ?? 'http://localhost:9000'
const MINIO_BUCKET = import.meta.env.VITE_MINIO_BUCKET ?? 'medtrain'

function toImageUrl(path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${MINIO_BASE}/${MINIO_BUCKET}/${path}`
}

const DOMAIN_COLORS = {
  radiologie:   { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', label: 'Pneumonie' },
  dermatologie: { bg: 'rgba(249,115,22,0.15)', text: '#fb923c', label: 'Dermatologie' },
  neurologie:   { bg: 'rgba(167,139,250,0.15)', text: '#a78bfa', label: 'Neurologie' },
}

function DomainPill({ domain }) {
  const { bg, text, label } = DOMAIN_COLORS[domain] ?? { bg: 'rgba(99,102,241,0.15)', text: '#818cf8', label: domain }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: bg, color: text }}
    >
      {label}
    </span>
  )
}

export default function HardestImagesGrid({ images = [] }) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-4"
      style={{ background: '#1a1d2e', border: '1px solid #2d2f45' }}
    >
      <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>
        Images les plus difficiles
      </p>

      {images.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '#94a3b8' }}>
          Pas encore de données
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, i) => {
            const url = toImageUrl(img.path)
            const pct = Math.round(img.error_rate * 100)
            return (
              <div
                key={img.image_id}
                className="rounded-lg overflow-hidden flex flex-col gap-2 transition-transform duration-200 hover:-translate-y-0.5"
                style={{ background: '#0f1117', border: '1px solid #2d2f45' }}
              >
                {/* Thumbnail */}
                <div className="aspect-square overflow-hidden bg-slate-800">
                  {url ? (
                    <img
                      src={url}
                      alt={`Image ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                      {i + 1}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-2 pb-2 flex flex-col gap-1.5">
                  <DomainPill domain={img.domain} />
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full self-start"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                  >
                    {pct}% d&apos;erreurs
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
