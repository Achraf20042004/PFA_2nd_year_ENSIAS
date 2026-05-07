import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Queue for concurrent 401s that arrive while a refresh is in flight
let isRefreshing = false
let failedQueue = []
// Prevents duplicate redirects when several requests fail simultaneously
let isSessionExpired = false

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

function redirectToLogin() {
  if (isSessionExpired) return
  isSessionExpired = true
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  // Clear Zustand persist store so the stale token is not restored on next load
  localStorage.removeItem('medtrain-auth')
  window.location.href = '/login'
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Pass through non-401 errors and already-retried requests
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Session already being torn down — don't pile on
    if (isSessionExpired) {
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      // If the user had an access token they were logged in; session is gone
      if (localStorage.getItem('access_token')) {
        redirectToLogin()
      }
      return Promise.reject(error)
    }

    // Another request is already refreshing — queue this one
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        originalRequest._retry = true
        return client(originalRequest)
      }).catch((err) => Promise.reject(err))
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post('/api/auth/refresh/', {
        refresh: refreshToken,
      })
      const newAccess = data.access
      localStorage.setItem('access_token', newAccess)
      client.defaults.headers.common.Authorization = `Bearer ${newAccess}`
      // Keep Zustand store in sync so onRehydrateStorage doesn't overwrite
      // localStorage with the old token on the next page reload.
      try {
        const { default: useAuthStore } = await import('../store/authStore')
        useAuthStore.getState().setTokens(newAccess, null)
      } catch { /* store unavailable — skip */ }
      processQueue(null, newAccess)
      originalRequest.headers.Authorization = `Bearer ${newAccess}`
      return client(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      redirectToLogin()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default client
