import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../../api/analytics'
import LoadingSpinner from '../../components/LoadingSpinner'
import { IconCheck, IconX, IconChart } from '../../components/icons'

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'success', label: 'Succès' },
  { value: 'error', label: 'Erreurs' },
  { value: 'running', label: 'En cours' },
]

const STEP_OPTIONS = [
  { value: '', label: 'Toutes les étapes' },
  { value: 'extract', label: 'Extract' },
  { value: 'validate', label: 'Validate' },
  { value: 'transform', label: 'Transform' },
  { value: 'load', label: 'Load' },
]

const DOMAIN_OPTIONS = [
  { value: '', label: 'Tous les domaines' },
  { value: 'pneumonie', label: 'Pneumonie' },
  { value: 'melanome', label: 'Dermatologie' },
  { value: 'tumeur', label: 'Neurologie' },
]

const STATUS_STYLE = {
  success: { icon: IconCheck, iconColor: 'text-primary', bg: 'bg-primary/10', label: 'Succès', text: 'text-primary' },
  error: { icon: IconX, iconColor: 'text-red-500', bg: 'bg-red-50', label: 'Erreur', text: 'text-red-600' },
  running: { icon: null, bg: 'bg-amber-50', label: 'En cours', text: 'text-amber-700' },
}

const STEP_COLORS = {
  extract: 'bg-blue-50 text-blue-700',
  validate: 'bg-violet-50 text-violet-700',
  transform: 'bg-orange-50 text-orange-700',
  load: 'bg-primary/10 text-primary',
}

function StatusIcon({ status }) {
  const s = STATUS_STYLE[status] ?? { bg: 'bg-slate-100', label: status, text: 'text-slate-600' }
  const Icon = s.icon
  return (
    <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center shrink-0`}>
      {Icon ? <Icon className={`w-3.5 h-3.5 ${s.iconColor}`} /> : (
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      )}
    </div>
  )
}

export default function ETLLogsPage() {
  const [status, setStatus] = useState('')
  const [step, setStep] = useState('')
  const [domain, setDomain] = useState('')
  const [dateFrom, setDateFrom] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['etl-logs', status, step, domain, dateFrom],
    queryFn: () => analyticsApi.etlLogs({
      status: status || undefined,
      step: step || undefined,
      domain: domain || undefined,
      date_from: dateFrom || undefined,
    }),
  })

  const logs = data?.results ?? data ?? []
  const total = data?.count ?? logs.length

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Logs ETL</h1>
        <p className="text-slate-500 text-sm">Audit du pipeline de traitement des datasets.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3">
        {/* Status */}
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === s.value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px bg-slate-200" />

        {/* Step */}
        <select
          value={step}
          onChange={(e) => setStep(e.target.value)}
          className="text-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {STEP_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Domain */}
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="text-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {DOMAIN_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>

        {/* Date from */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="text-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        {(status || step || domain || dateFrom) && (
          <button
            onClick={() => { setStatus(''); setStep(''); setDomain(''); setDateFrom('') }}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-slate-400 mb-3">{total} entrée{total !== 1 ? 's' : ''}</p>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-red-600 text-sm">Erreur de chargement des logs.</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <IconChart className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucun log pour ce filtre.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Statut</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Étape</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Dataset</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Message</th>
                <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Durée</th>
                <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log, i) => {
                const s = STATUS_STYLE[log.status] ?? {}
                return (
                  <tr key={log.id ?? i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={log.status} />
                        <span className={`text-xs font-medium ${s.text ?? 'text-slate-600'}`}>{s.label ?? log.status}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${STEP_COLORS[log.step] ?? 'bg-slate-100 text-slate-600'}`}>
                        {log.step ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 font-mono">#{log.dataset_id ?? '?'}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 max-w-xs truncate">{log.message ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-500">
                      {log.duration_ms != null ? `${log.duration_ms} ms` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                      {log.created_at ? new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
