'use client'

import { useState } from 'react'
import { getWebApp } from '@/lib/use-telegram-webapp'
import { useToast } from '@/components/ui/Toast'

interface Props {
  tokenOrSlug: string
  eventTitle: string
  endsAt: string | null
  startsAt: string
}

/**
 * Post-event "Wrapped" share card.
 * Only renders after the event has ended (or at least started > 6h ago).
 * Provides a CTA to share the recap to TG Story.
 */
export function WrappedCard({ tokenOrSlug, eventTitle, startsAt, endsAt }: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const now = Date.now()
  const startMs = new Date(startsAt).getTime()
  const endMs = endsAt ? new Date(endsAt).getTime() : startMs + 6 * 60 * 60 * 1000
  if (now < endMs) return null

  function share() {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
    const wrappedUrl = `${base}/og/event/${tokenOrSlug}/wrapped`
    const eventUrl = `${base}/e/${tokenOrSlug}`

    const webApp = getWebApp()
    if (webApp?.initData) {
      const versionParts = (webApp.version ?? '0').split('.').map(Number)
      const major = versionParts[0] ?? 0
      const minor = versionParts[1] ?? 0
      const supported = major > 7 || (major === 7 && minor >= 8)
      if (supported && typeof webApp.shareToStory === 'function') {
        setBusy(true)
        try {
          webApp.shareToStory(wrappedUrl, {
            text: `«${eventTitle}» — спасибо что были 💜`,
            widget_link: { url: eventUrl, name: 'Открыть в Event Gallery' },
          })
          webApp.HapticFeedback?.notificationOccurred('success')
        } catch {
          toast.show('Не получилось открыть Story', 'error')
        } finally {
          setTimeout(() => setBusy(false), 800)
        }
        return
      }
    }

    // Fallback: copy share URL
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: `${eventTitle} — Wrapped`, url: wrappedUrl }).catch(() => {})
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(wrappedUrl).then(() => {
        toast.show('Ссылка на рекап скопирована', 'success')
      })
    }
  }

  return (
    <div className="rounded-3xl bg-gradient-celebratory text-white p-6 sm:p-7 shadow-lifted animate-slide-up">
      <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">
        ✨ Ивент закончился
      </p>
      <h2 className="font-display text-2xl sm:text-3xl font-extrabold mb-3 text-balance">
        Поделись итогами
      </h2>
      <p className="text-sm opacity-90 mb-5 max-w-md">
        Wrapped-карточка со статистикой ивента: сколько пришло, фото, моменты.
        Идеально для Telegram Story.
      </p>
      <button
        onClick={share}
        disabled={busy}
        className="pill bg-white text-ink-900 shadow-soft hover:shadow-lifted hover:-translate-y-0.5 disabled:opacity-60 transition"
      >
        {busy ? 'Открываем…' : '📖 Поделиться в Story'}
      </button>
    </div>
  )
}
