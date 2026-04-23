import client from './client'

export const resultsApi = {
  me: () => client.get('/results/me/').then((r) => r.data),

  exercise: (id) => client.get(`/results/exercise/${id}/`).then((r) => r.data),
}
