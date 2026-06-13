import client from './client'

export const badgesApi = {
  me:      () => client.get('/badges/me/').then((r) => r.data),
  domains: () => client.get('/badges/domains/').then((r) => r.data),
  students:() => client.get('/badges/students/').then((r) => r.data),
}
