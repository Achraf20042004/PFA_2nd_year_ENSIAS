import client from './client'

export const usersApi = {
  list: (params) => client.get('/accounts/users/', { params }).then((r) => r.data),

  get: (id) => client.get(`/accounts/users/${id}/`).then((r) => r.data),

  update: (id, data) => client.patch(`/accounts/users/${id}/`, data).then((r) => r.data),

  approve: (id) => client.post(`/accounts/users/${id}/approve/`).then((r) => r.data),

  deactivate: (id) => client.post(`/accounts/users/${id}/deactivate/`).then((r) => r.data),
}
