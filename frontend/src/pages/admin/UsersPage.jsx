import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../api/users'
import LoadingSpinner from '../../components/LoadingSpinner'
import Button from '../../components/Button'
import { IconUser, IconCheck } from '../../components/icons'

const ROLES = [
  { value: '', label: 'Tous les rôles' },
  { value: 'admin', label: 'Administrateurs' },
  { value: 'prof', label: 'Professeurs' },
  { value: 'etudiant', label: 'Étudiants' },
]

const ROLE_STYLE = {
  admin: 'bg-red-100 text-red-700',
  prof: 'bg-violet-100 text-violet-700',
  etudiant: 'bg-primary/10 text-primary',
}

const ROLE_LABEL = { admin: 'Admin', prof: 'Prof', etudiant: 'Étudiant' }

function UserRow({ user, onApprove, onDeactivate }) {
  const initials = (user.first_name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()
  const isActive = user.is_active !== false

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-bold">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">
              {user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.username ?? user.email}
            </p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className={`text-xs font-medium px-2 py-1 rounded-lg ${ROLE_STYLE[user.role] ?? 'bg-slate-100 text-slate-600'}`}>
          {ROLE_LABEL[user.role] ?? user.role}
        </span>
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">{user.etablissement ?? '—'}</td>
      <td className="px-5 py-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {isActive ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td className="px-5 py-4 text-sm text-slate-500">
        {user.date_joined ? new Date(user.date_joined).toLocaleDateString('fr-FR') : '—'}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-2">
          {!isActive && (
            <button
              onClick={() => onApprove(user.id)}
              className="text-xs px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors font-medium"
            >
              Approuver
            </button>
          )}
          {isActive && user.role !== 'admin' && (
            <button
              onClick={() => onDeactivate(user.id)}
              className="text-xs px-2.5 py-1.5 border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors font-medium"
            >
              Désactiver
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  })

  const approveMutation = useMutation({
    mutationFn: (id) => usersApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const allUsers = data?.results ?? data ?? []

  const filtered = allUsers.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        u.email?.toLowerCase().includes(q) ||
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q) ||
        u.etablissement?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const countByRole = { admin: 0, prof: 0, etudiant: 0 }
  allUsers.forEach((u) => { if (countByRole[u.role] != null) countByRole[u.role]++ })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Utilisateurs</h1>
        <p className="text-slate-500 text-sm">{allUsers.length} comptes enregistrés</p>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { role: 'admin', label: 'Administrateurs', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
          { role: 'prof', label: 'Professeurs', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
          { role: 'etudiant', label: 'Étudiants', color: 'text-primary', bg: 'bg-primary-light', border: 'border-primary/20' },
        ].map((r) => (
          <button
            key={r.role}
            onClick={() => setRoleFilter(roleFilter === r.role ? '' : r.role)}
            className={`text-left p-4 rounded-2xl border ${r.border} ${roleFilter === r.role ? r.bg : 'bg-white'} shadow-sm hover:shadow-md transition-all`}
          >
            <p className={`font-heading font-bold text-2xl ${r.color}`}>{countByRole[r.role]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{r.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRoleFilter(r.value)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                roleFilter === r.value ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-red-600 text-sm">Erreur de chargement. L'endpoint /api/accounts/users/ est peut-être manquant.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <IconUser className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Utilisateur</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Rôle</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Établissement</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Statut</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Inscrit le</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onDeactivate={(id) => deactivateMutation.mutate(id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
