'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { coHostsApi, type CoHostInvitePreview } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'
import { CoverImage } from '@/components/event/CoverImage'

export function CoHostAcceptClient({ token }: { token: string }) {
  const router = useRouter()
  const toast = useToast()
  const { status } = useSession()
  const [preview, setPreview] = useState<CoHostInvitePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const { preview } = await coHostsApi.getInvite(token)
      setPreview(preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Приглашение не найдено')
    }
  }, [token])

  useEffect(() => { load() }, [load])

  async function accept() {
    setBusy(true)
    try {
      const res = await coHostsApi.acceptInvite(token)
      toast.show('Принято — теперь ты co-host', 'success')
      router.push(`/e/${res.coHost.eventId}/host`)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не получилось', 'error')
      setBusy(false)
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cream-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">😞</div>
          <h1 className="font-display text-2xl font-bold mb-2">{error}</h1>
          <p className="text-sm text-ink-900/60 mb-6">
            Возможно, ссылка устарела или была отозвана.
          </p>
          <Link href="/" className="pill-secondary text-sm">На главную</Link>
        </div>
      </main>
    )
  }

  if (!preview) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-ink-900/50">Загружаем…</p>
      </main>
    )
  }

  const dateStr = new Date(preview.eventStartsAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-cream-50 via-white to-white px-4 py-12">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] hero-blob pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-md animate-slide-up">
        <CoverImage
          imageUrl={null}
          coverPresetSlug={preview.coverPresetSlug}
          className="w-full aspect-[16/10] rounded-3xl mb-6 shadow-lifted overflow-hidden"
        />

        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
            👥 Приглашение co-host
          </p>
          <h1 className="font-display text-display-md text-balance text-ink-900 mb-2">
            {preview.eventTitle}
          </h1>
          <p className="text-sm text-ink-900/60">
            {preview.hostName} приглашает тебя помогать с этим ивентом — ты сможешь править детали, видеть гостей и аналитику.
          </p>
          <p className="text-xs text-ink-900/50 mt-2">{dateStr}</p>
        </div>

        {status === 'loading' && <p className="text-center text-sm text-ink-900/50">…</p>}

        {status === 'unauthenticated' && (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-5 text-center">
            <p className="text-sm text-ink-900/70 mb-4">Чтобы принять приглашение, войди через Google.</p>
            <Link
              href={`/auth/signin?callbackUrl=/co-host/${token}`}
              className="pill-brand w-full"
            >
              Войти через Google
            </Link>
          </div>
        )}

        {status === 'authenticated' && (
          <button
            onClick={accept}
            disabled={busy}
            className="w-full px-6 py-4 bg-gradient-celebratory text-white rounded-2xl font-display font-bold shadow-lifted hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {busy ? 'Принимаем…' : 'Стать co-host →'}
          </button>
        )}

        <p className="mt-4 text-center text-xs text-ink-900/40">
          Co-host видит всё что хост, но не может удалить ивент или передать его другому.
        </p>
      </div>
    </main>
  )
}
