import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/auth'

/** Decode a JWT payload without any library — no signature verification needed client-side. */
function parseJwtPayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

/**
 * Build a minimal user object from the JWT payload.
 * Django simplejwt puts `user_id` in the payload; custom claims (role, email)
 * depend on what the backend serializer adds.
 */
function userFromPayload(payload) {
  return {
    id: payload.user_id ?? payload.id ?? null,
    email: payload.email ?? null,
    role: payload.role ?? null,
    first_name: payload.first_name ?? null,
    last_name: payload.last_name ?? null,
    etablissement: payload.etablissement ?? null,
  }
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      isAuthenticated: () => !!get().accessToken,

      login: async (email, password) => {
        const data = await authApi.login(email, password)
        localStorage.setItem('access_token', data.access)
        localStorage.setItem('refresh_token', data.refresh)

        // Prefer the full user object if the login endpoint returns it,
        // otherwise decode what we can from the JWT payload.
        const payload = parseJwtPayload(data.access)
        const user = data.user ?? userFromPayload(payload)

        set({ accessToken: data.access, refreshToken: data.refresh, user })
        return data
      },

      /** Call /api/auth/me/ to refresh the full user profile in the store. */
      fetchMe: async () => {
        try {
          const user = await authApi.me()
          set({ user })
          return user
        } catch {
          return null
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, refreshToken: null })
      },

      setUser: (user) => set({ user }),

      setTokens: (access, refresh) => {
        localStorage.setItem('access_token', access)
        if (refresh) localStorage.setItem('refresh_token', refresh)
        set({ accessToken: access, ...(refresh ? { refreshToken: refresh } : {}) })
      },
    }),
    {
      name: 'medtrain-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
)

export default useAuthStore
