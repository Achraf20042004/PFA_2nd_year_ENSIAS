import client from './client'

export const badgesApi = {
  me: () => client.get('/badges/me/').then((r) => r.data),
}
