'use client'

import { useEffect, useState } from 'react'
import { getWebApp } from './use-telegram-webapp'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
const TOKEN_KEY = 'wishly_access_token'
const TG_AUTH_FLAG = 'wishly_tg_auth_active'

interface TgAuthState {
  status: 'idle' | 'authenticating' | 'authenticated' | 'failed' | 'unavailable'
  error: string | null
  userId: string | null
}

/**
 * Auto-authenticate via Telegram initData if we're inside the TG WebApp.
 * Posts initData to /auth/telegram-init, stores returned JWT in localStorage.
 * Idempotent: skips re-auth if a session is already active.
 */
export function useTelegramAuth(): TgAuthState {
  const [state, setState] = useState<TgAuthState>({
    status: 'idle',
    error: null,
    userId: null,
  })

  useEffect(() => {
    const webApp = getWebApp()
    if (!webApp || !webApp.initData) {
      setState({ status: 'unavailable', error: null, userId: null })
      return
    }

    // Skip if we already auth'd this TG session
    if (
      typeof window !== 'undefined' &&
      localStorage.getItem(TOKEN_KEY) &&
      sessionStorage.getItem(TG_AUTH_FLAG)
    ) {
      setState({ status: 'authenticated', error: null, userId: null })
      return
    }

    setState({ status: 'authenticating', error: null, userId: null })

    fetch(`${API_BASE}/auth/telegram-init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: webApp.initData }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(err.error ?? 'Auth failed')
        }
        return res.json() as Promise<{ accessToken: string; user: { id: string } }>
      })
      .then((data) => {
        localStorage.setItem(TOKEN_KEY, data.accessToken)
        sessionStorage.setItem(TG_AUTH_FLAG, '1')
        setState({ status: 'authenticated', error: null, userId: data.user.id })
      })
      .catch((err) => {
        setState({
          status: 'failed',
          error: err instanceof Error ? err.message : 'Auth failed',
          userId: null,
        })
      })
  }, [])

  return state
}
