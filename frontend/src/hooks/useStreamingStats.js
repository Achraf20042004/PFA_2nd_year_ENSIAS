import { useCallback, useEffect, useRef, useState } from 'react'
import useAuthStore from '../store/authStore'

// Exponential backoff delays (ms): 1s 2s 4s 8s 16s 30s 30s ...
const BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000]

/**
 * Opens a WebSocket to the streaming analytics endpoint and keeps it alive.
 * The token is read from the Zustand auth store and appended as a query param
 * because the browser WebSocket API does not support custom headers.
 *
 * @returns {{ stats: object|null, isConnected: boolean, error: string|null }}
 */
export function useStreamingStats() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const [stats, setStats] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)

  const wsRef = useRef(null)
  const attemptRef = useRef(0)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!accessToken || !mountedRef.current) return

    // Use window.location.host so the Vite WS proxy (/ws → ws://localhost:8000)
    // handles dev; in production both HTTP and WS come from the same origin.
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/ws/analytics/streaming/?token=${accessToken}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      setIsConnected(true)
      setError(null)
      attemptRef.current = 0
    }

    ws.onmessage = (e) => {
      if (!mountedRef.current) return
      try {
        setStats(JSON.parse(e.data))
      } catch {
        // ignore malformed frames
      }
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setError('Erreur de connexion WebSocket.')
    }

    ws.onclose = (e) => {
      if (!mountedRef.current) return
      setIsConnected(false)
      // 4003 = unauthorised — don't retry
      if (e.code === 4003) {
        setError('Accès non autorisé.')
        return
      }
      const delay = BACKOFF[Math.min(attemptRef.current, BACKOFF.length - 1)]
      attemptRef.current += 1
      timerRef.current = setTimeout(connect, delay)
    }
  }, [accessToken])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(timerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null  // suppress reconnect on intentional close
        wsRef.current.close(1000)
      }
    }
  }, [connect])

  return { stats, isConnected, error }
}
