import client from './client'

export const coursesApi = {
  list: (params) => client.get('/courses/', { params }).then((r) => r.data),

  get: (id) => client.get(`/courses/${id}/`).then((r) => r.data),

  upload: (formData) =>
    client.post('/courses/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
}
