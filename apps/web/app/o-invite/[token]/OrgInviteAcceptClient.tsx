'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { orgsApi } from '@/lib/api-client'

export function OrgInviteAcceptClient({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const { org } = await orgsApi.acceptInvite(token)
      router.push(`/o/${org.slug}/admin`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось принять')
      setBusy(false)
    }
  }

  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('wishly_access_token')

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cream-50 via-white to-white px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="text-6xl">🤝</div>
        <h1 className="font-display text-3xl font-extrabold text-ink-900 tracking-tight">
          Приглашение в команду
        </h1>
        <p className="text-sm text-ink-900/70">
          Кто-то приглашает тебя в свою организацию на Event Gallery. Войди через Telegram
          и подтверди — будешь видеть все ивенты команды.
        </p>

        {!hasToken ? (
          <Link
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/o-invite/${token}`)}`}
            className="block w-full pill bg-gradient-celebratory text-white text-sm py-3 shadow-soft"
          >
            Войти через Telegram →
          </Link>
        ) : (
          <button
            onClick={accept}
            disabled={busy}
            className="w-full pill bg-gradient-celebratory text-white text-sm py-3 shadow-soft disabled:opacity-50"
          >
            {busy ? 'Принимаем…' : 'Принять приглашение →'}
          </button>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <Link href="/" className="block text-xs text-ink-900/50 hover:text-ink-900">
          ← Не сейчас
        </Link>
      </div>
    </main>
  )
}
