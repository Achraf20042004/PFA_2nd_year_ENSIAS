import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exercisesApi } from '../../api/exercises'
import { datasetsApi } from '../../api/datasets'
import LoadingSpinner from '../../components/LoadingSpinner'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { IconBook, IconChart } from '../../components/icons'

const MALADIE_OPTIONS = [
  { value: 'pneumonie', label: 'Radiologie — Pneumonie' },
  { value: 'melanome', label: 'Dermatologie — Mélanome' },
]
const DIFFICULTY_OPTIONS = ['facile', 'moyen', 'difficile']
const DOMAIN_BADGE = {
  pneumonie: 'bg-blue-50 text-blue-700',
  melanome: 'bg-orange-50 text-orange-700',
}

const EMPTY_FORM = {
  titre: '',
  maladie: 'pneumonie',
  dataset: '',
  difficulte: 'moyen',
  description: '',
  actif: true,
  exam_config: {
    est_examen: false,
    nb_images: 10,
    duree_minutes: 30,
    max_tentatives: '',
    deadline: '',
  },
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${className}`}
      {...props}
    />
  )
}

function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors appearance-none ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

function ExerciseForm({ form, onChange, datasets, datasetsLoading }) {
  function set(field, value) {
    onChange({ ...form, [field]: value })
  }
  function setExam(field, value) {
    onChange({ ...form, exam_config: { ...form.exam_config, [field]: value } })
  }

  return (
    <div className="space-y-4">
      <Field label="Titre">
        <Input value={form.titre} onChange={(e) => set('titre', e.target.value)} placeholder="Ex: Radiologie avancée" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Domaine médical">
          <Select value={form.maladie} onChange={(e) => set('maladie', e.target.value)}>
            {MALADIE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Difficulté">
          <Select value={form.difficulte} onChange={(e) => set('difficulte', e.target.value)}>
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d} value={d} className="capitalize">{d}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Dataset d'images" hint="Le dataset doit être préalablement uploadé et prêt.">
        <Select value={form.dataset} onChange={(e) => set('dataset', e.target.value)} disabled={datasetsLoading}>
          {datasetsLoading ? (
            <option value="">Chargement des datasets…</option>
          ) : (
            <>
              <option value="">— Sélectionner un dataset —</option>
              {(datasets?.results ?? datasets ?? [])
                .filter((d) => d.statut === 'ready')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.maladie} · Dataset #{d.id} · {d.nb_images} images
                  </option>
                ))}
            </>
          )}
        </Select>
      </Field>

      <Field label="Description (optionnel)">
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          placeholder="Instructions pour les étudiants..."
          className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
        />
      </Field>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.actif}
          onChange={(e) => set('actif', e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
        />
        <span className="text-sm text-slate-700">Exercice actif (visible par les étudiants)</span>
      </label>

      {/* Exam config */}
      <div className="pt-3 border-t border-slate-100">
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={form.exam_config.est_examen}
            onChange={(e) => setExam('est_examen', e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-slate-700">C'est un examen noté</span>
        </label>

        {form.exam_config.est_examen && (
          <div className="bg-slate-50 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre d'images">
                <Input type="number" min={1} max={50} value={form.exam_config.nb_images} onChange={(e) => setExam('nb_images', parseInt(e.target.value))} />
              </Field>
              <Field label="Durée (minutes)">
                <Input type="number" min={5} max={180} value={form.exam_config.duree_minutes} onChange={(e) => setExam('duree_minutes', parseInt(e.target.value))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tentatives max" hint="Laisser vide = illimité">
                <Input type="number" min={1} value={form.exam_config.max_tentatives} onChange={(e) => setExam('max_tentatives', e.target.value)} placeholder="Illimité" />
              </Field>
              <Field label="Date limite">
                <Input type="datetime-local" value={form.exam_config.deadline} onChange={(e) => setExam('deadline', e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {!form.exam_config.est_examen && (
          <Field label="Nombre d'images par session">
            <Input type="number" min={1} max={50} value={form.exam_config.nb_images} onChange={(e) => setExam('nb_images', parseInt(e.target.value))} />
          </Field>
        )}
      </div>
    </div>
  )
}

export default function MyExercisesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'create' | { id, ...exercise }
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [formError, setFormError] = useState(null)

  const { data: exercisesData, isLoading } = useQuery({
    queryKey: ['my-exercises'],
    queryFn: () => exercisesApi.list(),
  })

  const { data: datasetsData, isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsApi.list(),
    staleTime: 0, // always fetch fresh — never show a stale empty-dataset cache
  })

  const exercises = exercisesData?.results ?? exercisesData ?? []

  const createMutation = useMutation({
    mutationFn: (data) => exercisesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-exercises'] }); setModal(null); setForm(EMPTY_FORM) },
    onError: (e) => setFormError(e.response?.data?.detail ?? 'Erreur lors de la création.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => exercisesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-exercises'] }); setModal(null) },
    onError: (e) => setFormError(e.response?.data?.detail ?? 'Erreur lors de la mise à jour.'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, actif }) => exercisesApi.update(id, { actif }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-exercises'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => exercisesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-exercises'] }); setConfirmDelete(null) },
  })

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setModal('create')
  }

  function openEdit(ex) {
    setForm({
      titre: ex.titre ?? '',
      maladie: ex.maladie ?? 'pneumonie',
      dataset: ex.dataset ?? '',
      difficulte: ex.difficulte ?? 'moyen',
      description: ex.description ?? '',
      actif: ex.actif ?? true,
      exam_config: {
        est_examen: ex.exam_config?.est_examen ?? false,
        nb_images: ex.exam_config?.nb_images ?? 10,
        duree_minutes: ex.exam_config?.duree_minutes ?? 30,
        max_tentatives: ex.exam_config?.max_tentatives ?? '',
        deadline: ex.exam_config?.deadline ? ex.exam_config.deadline.slice(0, 16) : '',
      },
    })
    setFormError(null)
    setModal({ id: ex.id })
  }

  function handleSubmit() {
    const payload = {
      ...form,
      dataset: form.dataset || undefined,
      exam_config: {
        ...form.exam_config,
        max_tentatives: form.exam_config.max_tentatives ? parseInt(form.exam_config.max_tentatives) : null,
        deadline: form.exam_config.deadline || null,
      },
    }
    setFormError(null)
    if (modal === 'create') {
      createMutation.mutate(payload)
    } else {
      updateMutation.mutate({ id: modal.id, data: payload })
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 mb-1">Mes exercices</h1>
          <p className="text-slate-500 text-sm">{exercises.length} exercice{exercises.length !== 1 ? 's' : ''} créé{exercises.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} size="lg">+ Créer un exercice</Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : exercises.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-100">
          <IconBook className="w-10 h-10 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium mb-2">Aucun exercice créé</p>
          <p className="text-sm text-slate-400 mb-5">Créez votre premier exercice pour commencer.</p>
          <Button onClick={openCreate}>Créer un exercice</Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Exercice</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Domaine</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Type</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">Statut</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {exercises.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-800">{ex.titre ?? `Exercice #${ex.id}`}</p>
                    <p className="text-xs text-slate-400 capitalize mt-0.5">{ex.difficulte} · {ex.exam_config?.nb_images ?? 10} images</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${DOMAIN_BADGE[ex.maladie] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ex.maladie}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${ex.exam_config?.est_examen ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {ex.exam_config?.est_examen ? 'Examen' : 'Entraînement'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => toggleMutation.mutate({ id: ex.id, actif: !ex.actif })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${ex.actif ? 'bg-primary' : 'bg-slate-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${ex.actif ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs text-slate-400 ml-2">{ex.actif ? 'Actif' : 'Inactif'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(ex)}
                        className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:border-primary hover:text-primary transition-colors font-medium"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setConfirmDelete(ex)}
                        className="text-xs px-3 py-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors font-medium"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Créer un exercice' : 'Modifier l\'exercice'}
        width="max-w-2xl"
      >
        <ExerciseForm form={form} onChange={setForm} datasets={datasetsData} datasetsLoading={datasetsLoading} />

        {formError && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
          <Button onClick={handleSubmit} loading={isSubmitting}>
            {modal === 'create' ? 'Créer l\'exercice' : 'Enregistrer'}
          </Button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Supprimer l'exercice">
        <p className="text-sm text-slate-600 mb-4">
          Êtes-vous sûr de vouloir supprimer <strong>{confirmDelete?.titre ?? `l'exercice #${confirmDelete?.id}`}</strong> ?
          Cette action est irréversible et supprimera toutes les tentatives associées.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>Annuler</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(confirmDelete.id)}>
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </div>
  )
}
