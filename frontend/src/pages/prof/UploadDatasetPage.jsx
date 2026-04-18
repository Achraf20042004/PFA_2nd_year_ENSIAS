import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { datasetsApi } from '../../api/datasets'
import Button from '../../components/Button'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconDatabase, IconCheck, IconX } from '../../components/icons'

const DOMAINS = [
  {
    value: 'pneumonie',
    label: 'Radiologie',
    sub: 'Pneumonie',
    model: 'nickmuchi/vit-finetuned-chest-xray-pneumonia',
    format: '256×256 px, niveaux de gris ou RGB',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    activeBg: 'bg-blue-600',
  },
  {
    value: 'melanome',
    label: 'Dermatologie',
    sub: 'Mélanome',
    model: 'anonymous-german-shepherd/skin-cancer',
    format: '224×224 px, RGB',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    activeBg: 'bg-orange-600',
  },
  {
    value: 'retinopathie',
    label: 'Ophtalmologie',
    sub: 'Rétinopathie diabétique',
    model: 'gauravlochab/diabetic-retinopathy-vit-base',
    format: '299×299 px, RGB',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    activeBg: 'bg-violet-600',
  },
]

const STATUS_LABELS = {
  uploaded: { label: 'Uploadé', color: 'bg-slate-100 text-slate-600' },
  processing: { label: 'En traitement', color: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Prêt', color: 'bg-primary/10 text-primary' },
  error: { label: 'Erreur', color: 'bg-red-100 text-red-700' },
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
}

export default function UploadDatasetPage() {
  const fileRef = useRef(null)
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadedId, setUploadedId] = useState(null)
  const [statusPoll, setStatusPoll] = useState(false)

  const { data: datasetsData, refetch: refetchDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsApi.list(),
  })

  const { data: statusData } = useQuery({
    queryKey: ['dataset-status', uploadedId],
    queryFn: () => datasetsApi.status(uploadedId),
    enabled: !!uploadedId && statusPoll,
    refetchInterval: (data) => {
      if (data?.statut === 'ready' || data?.statut === 'error') {
        setStatusPoll(false)
        refetchDatasets()
        return false
      }
      return 3000
    },
  })

  const uploadMutation = useMutation({
    mutationFn: ({ domain, file }) => {
      const fd = new FormData()
      fd.append('fichier_zip', file)
      fd.append('maladie', domain)
      return datasetsApi.upload(fd)
    },
    onSuccess: (data) => {
      setUploadedId(data.id)
      setStatusPoll(true)
      setFile(null)
      refetchDatasets()
    },
  })

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.zip')) setFile(f)
  }

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (f) setFile(f)
  }

  function handleUpload() {
    if (!selectedDomain || !file) return
    uploadMutation.mutate({ domain: selectedDomain.value, file })
  }

  const datasets = datasetsData?.results ?? datasetsData ?? []
  const canUpload = selectedDomain && file && !uploadMutation.isPending

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Upload dataset</h1>
        <p className="text-slate-500 text-sm">Importez un ZIP d'images pour entraîner le pipeline ETL.</p>
      </div>

      {/* Step 1 — Domain */}
      <div className="mb-8">
        <h2 className="font-heading font-semibold text-slate-800 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold mr-2">1</span>
          Choisissez le domaine médical
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DOMAINS.map((d) => (
            <button
              key={d.value}
              onClick={() => setSelectedDomain(d)}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${
                selectedDomain?.value === d.value
                  ? `${d.bg} ${d.border} shadow-md`
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-10 h-10 ${d.bg} rounded-xl flex items-center justify-center mb-3 border ${d.border}`}>
                <IconDatabase className={`w-5 h-5 ${d.text}`} />
              </div>
              <p className="font-heading font-bold text-slate-900 text-sm">{d.label}</p>
              <p className={`text-xs font-medium mt-0.5 ${d.text}`}>{d.sub}</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">Modèle : {d.model.split('/')[1]}</p>
              <p className="text-xs text-slate-400 mt-0.5">Format : {d.format}</p>
              {selectedDomain?.value === d.value && (
                <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${d.text}`}>
                  <IconCheck className="w-3.5 h-3.5" /> Sélectionné
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — File */}
      <div className="mb-8">
        <h2 className="font-heading font-semibold text-slate-800 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold mr-2">2</span>
          Importez votre fichier ZIP
        </h2>

        <div className="bg-primary-light border border-primary/20 rounded-xl px-4 py-3 text-sm text-primary mb-4">
          Le ZIP doit contenir deux dossiers : <code className="font-mono bg-primary/10 px-1 rounded">malade/</code> et <code className="font-mono bg-primary/10 px-1 rounded">sain/</code>, chacun avec au moins 10 images JPEG/PNG.
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
            dragOver ? 'border-primary bg-primary-light' : file ? 'border-primary/40 bg-primary-light' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <input ref={fileRef} type="file" accept=".zip" onChange={handleFileChange} className="hidden" />

          {file ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <IconCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                className="ml-4 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">Glissez-déposez votre ZIP ici</p>
              <p className="text-xs text-slate-400">ou cliquez pour sélectionner un fichier</p>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={!canUpload}
            loading={uploadMutation.isPending}
            size="lg"
          >
            {uploadMutation.isPending ? 'Upload en cours...' : 'Lancer le traitement ETL'}
          </Button>
        </div>
      </div>

      {/* Upload status */}
      {uploadedId && (
        <div className={`mb-8 border rounded-2xl p-5 ${statusData?.statut === 'ready' ? 'bg-primary-light border-primary/20' : statusData?.statut === 'error' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex items-center gap-3">
            {statusData?.statut === 'ready'
              ? <IconCheck className="w-5 h-5 text-primary" />
              : statusData?.statut === 'error'
              ? <IconX className="w-5 h-5 text-red-500" />
              : <LoadingSpinner size="sm" />
            }
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {statusData?.statut === 'ready' ? 'Dataset prêt !' : statusData?.statut === 'error' ? 'Erreur de traitement' : 'Pipeline ETL en cours...'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Dataset #{uploadedId} · {statusData?.statut ?? 'processing'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Existing datasets */}
      {datasets.length > 0 && (
        <div>
          <h2 className="font-heading font-semibold text-slate-800 mb-4">Mes datasets</h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">ID</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Domaine</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {datasets.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">#{d.id}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 capitalize">{d.maladie}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={d.statut} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
