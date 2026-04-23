import client from './client'

export const datasetsApi = {
  list: (params) => client.get('/datasets/', { params }).then((r) => r.data),

  get: (id) => client.get(`/datasets/${id}/`).then((r) => r.data),

  upload: (formData) =>
    client.post('/datasets/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  status: (id) => client.get(`/datasets/${id}/status/`).then((r) => r.data),
}
