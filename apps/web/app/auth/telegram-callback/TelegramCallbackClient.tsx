'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

/**
 * Receives the redirect from Telegram Login Widget (data-auth-url mode).
 * URL contains: id, first_name, last_name?, username?, photo_url?, auth_date, hash.
 * POSTs them to /api/v1/auth/telegram-login → JWT → localStorage → /dashboard.
 */
export function TelegramCallbackClient() {
  const router = useRouter()
  const search = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'authing' | 'done' | 'failed'>('authing')

  useEffect(() => {
    const id = search.get('id')
    const hash = search.get('hash')
    const authDate = search.get('auth_date')

    if (!id || !hash || !authDate) {
      setError('Не вижу данных от Telegram. Попробуй ещё раз.')
      setStatus('failed')
      return
    }

    const payload: Record<string, string> = {
      id,
      auth_date: authDate,
      hash,
    }
    const first = search.get('first_name')
    const last = search.get('last_name')
    const username = search.get('username')
    const photo = search.get('photo_url')
    if (first) payload.first_name = first
    if (last) payload.last_name = last
    if (username) payload.username = username
    if (photo) payload.photo_url = photo

    ;(async () => {
      try {
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
        setStatus('done')
        const fallback = '/dashboard'
        // Optional: callbackUrl preserved if widget redirect included it
        const cb = search.get('callbackUrl') ?? fallback
        router.push(cb)
        router.refresh()
      } catch (err) {
        setStatus('failed')
        setError(err instanceof Error ? err.message : 'Не получилось войти')
      }
    })()
  }, [router, search])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cream-50 via-white to-white px-4">
      <div className="text-center space-y-4 max-w-md">
        {status === 'authing' && (
          <>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-celebratory animate-pulse" />
            <p className="text-sm text-ink-900/60">Создаём сессию…</p>
          </>
        )}
        {status === 'done' && (
          <>
            <div className="text-5xl">✨</div>
            <p className="text-sm text-ink-900/70">Готово! Перенаправляем…</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <div className="text-5xl">😕</div>
            <h1 className="font-display text-xl font-bold text-ink-900">Не удалось войти</h1>
            <p className="text-sm text-rose-600">{error}</p>
            <a href="/auth/signin" className="pill bg-ink-900 text-white text-sm inline-flex">
              Попробовать ещё раз
            </a>
          </>
        )}
      </div>
    </main>
  )
}
