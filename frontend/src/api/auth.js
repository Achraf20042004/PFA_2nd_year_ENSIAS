import client from './client'
import axios from 'axios'

export const authApi = {
  login: (email, password) =>
    axios.post('/api/auth/login/', { email, password }).then((r) => r.data),

  register: (data) =>
    axios.post('/api/auth/register/', data).then((r) => r.data),

  refresh: (refreshToken) =>
    axios.post('/api/auth/refresh/', { refresh: refreshToken }).then((r) => r.data),

  me: () => client.get('/auth/me/').then((r) => r.data),
}
