import client from './client'

export const exercisesApi = {
  list: (params) => client.get('/exercises/', { params }).then((r) => r.data),

  get: (id) => client.get(`/exercises/${id}/`).then((r) => r.data),

  start: (id) => client.get(`/exercises/${id}/start/`).then((r) => r.data),

  create: (data) => client.post('/exercises/', data).then((r) => r.data),

  update: (id, data) => client.patch(`/exercises/${id}/`, data).then((r) => r.data),

  delete: (id) => client.delete(`/exercises/${id}/`).then((r) => r.data),

  results: (id) => client.get(`/results/exercise/${id}/`).then((r) => r.data),
}
