'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void
  }
}

/**
 * Telegram Login Widget. Renders an official TG button (script-injected) that
 * authenticates the user via a popup. On success, we POST the signed payload
 * to /api/v1/auth/telegram-login, store the JWT in localStorage, and redirect.
 *
 * Bot domain must be set via @BotFather /setdomain to match the page origin
 * — without that, the widget will refuse to render or auth.
 *
 * For localhost dev: TG requires a public domain. Use ngrok or set domain to
 * your dev URL via @BotFather. Until then, the widget shows but auth fails.
 */
export function TelegramLoginButton({ botName }: { botName: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const search = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.onTelegramAuth = async (user: TelegramUser) => {
      setBusy(true)
      setError(null)
      try {
        const payload: Record<string, string> = {
          id: String(user.id),
          auth_date: String(user.auth_date),
          hash: user.hash,
        }
        if (user.first_name) payload.first_name = user.first_name
        if (user.last_name) payload.last_name = user.last_name
        if (user.username) payload.username = user.username
        if (user.photo_url) payload.photo_url = user.photo_url

        const res = await fetch(`${API_BASE}/auth/telegram-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody.error ?? `HTTP ${res.status}`)
        }
        const data = (await res.json()) as { accessToken: string }
        localStorage.setItem('wishly_access_token', data.accessToken)
        const callback = search.get('callbackUrl') ?? '/dashboard'
        router.push(callback)
        router.refresh()
      } catch (err) {
        setBusy(false)
        setError(err instanceof Error ? err.message : 'Не удалось войти')
      }
    }
    return () => { delete window.onTelegramAuth }
  }, [router, search])

  // Inject the official TG widget script. Use data-auth-url for reliability —
  // TG will redirect to our callback page with signed query params instead of
  // calling a JS callback (which can race with React lifecycle).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const callbackPath = search.get('callbackUrl') ?? '/dashboard'
    const authUrl = `${origin}/auth/telegram-callback?callbackUrl=${encodeURIComponent(callbackPath)}`

    // Clear any previously-rendered widget iframes (HMR / Strict Mode safety)
    container.innerHTML = ''

    const script = document.createElement('script')
    script.async = true
    script.src = `https://telegram.org/js/telegram-widget.js?22&_t=${Date.now()}`
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '20')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-auth-url', authUrl)
    container.appendChild(script)
    return () => {
      try { container.innerHTML = '' } catch { /* noop */ }
    }
  }, [botName, search])

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className={`flex justify-center min-h-[48px] items-center ${busy ? 'opacity-50 pointer-events-none' : ''}`}
      />
      {busy && (
        <p className="text-center text-sm text-ink-900/60">Создаём сессию…</p>
      )}
      {error && (
        <p className="text-center text-sm text-rose-600">{error}</p>
      )}
      <p className="text-[11px] text-ink-900/40 text-center leading-snug">
        Не видишь кнопку? Бот должен быть привязан к этому домену через
        @BotFather /setdomain (для прод-домена это разово делается).
      </p>
    </div>
  )
}
