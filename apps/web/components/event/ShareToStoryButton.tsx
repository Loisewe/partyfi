'use client'

import { useState } from 'react'
import { getWebApp } from '@/lib/use-telegram-webapp'
import { useToast } from '@/components/ui/Toast'

interface Props {
  tokenOrSlug: string
  eventTitle: string
}

/**
 * Share an event as a vertical Story to Telegram.
 * Uses `webApp.shareToStory` (TG WebApp 7.8+) with our vertical OG image.
 * No-op gracefully when not in TG context.
 */
export function ShareToStoryButton({ tokenOrSlug, eventTitle }: Props) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  function share() {
    const webApp = getWebApp()
    if (!webApp || !webApp.initData) {
      toast.show('Поделиться в Story можно только через Telegram Mini App', 'info')
      return
    }
    // shareToStory was added in WebApp v7.8
    const versionParts = (webApp.version ?? '0').split('.').map(Number)
    const major = versionParts[0] ?? 0
    const minor = versionParts[1] ?? 0
    const supported = major > 7 || (major === 7 && minor >= 8)
    if (!supported) {
      toast.show('Обнови Telegram для шаринга в Story', 'info')
      return
    }
    if (typeof webApp.shareToStory !== 'function') {
      toast.show('Этот клиент Telegram не поддерживает Story', 'info')
      return
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
    const mediaUrl = `${base}/og/event/${tokenOrSlug}/story`
    const eventUrl = `${base}/e/${tokenOrSlug}`

    setBusy(true)
    try {
      webApp.shareToStory(mediaUrl, {
        text: `Зову тебя на ${eventTitle} 🎉`,
        widget_link: { url: eventUrl, name: 'Открыть в Event Gallery' },
      })
      webApp.HapticFeedback?.notificationOccurred('success')
    } catch (err) {
      toast.show('Не получилось открыть Story', 'error')
      console.error(err)
    } finally {
      setTimeout(() => setBusy(false), 800)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy}
      className="pill bg-gradient-violet-pink text-white shadow-soft hover:shadow-lifted hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 transition"
    >
      <span>📖</span> {busy ? 'Открываем…' : 'В Story'}
    </button>
  )
}
