import client from './client'

export const attemptsApi = {
  submit: (data) => client.post('/attempts/', data).then((r) => r.data),

  feedback: (id) => client.get(`/attempts/${id}/feedback/`).then((r) => r.data),
}
