'use client'

import { useEffect, useState } from 'react'

// Minimal TG WebApp surface we use. Full spec: https://core.telegram.org/bots/webapps
interface TelegramWebApp {
  initData: string
  initDataUnsafe?: {
    user?: { id: number; first_name?: string; username?: string }
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  ready: () => void
  expand: () => void
  close: () => void
  MainButton: {
    text: string
    show: () => void
    hide: () => void
    setText: (text: string) => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
  }
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  openInvoice: (url: string, callback?: (status: string) => void) => void
  openTelegramLink: (url: string) => void
  shareToStory?: (mediaUrl: string, params?: { text?: string; widget_link?: { url: string; name?: string } }) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

/**
 * Hook that returns the WebApp instance once available, plus a boolean isInTelegram.
 * Calls webApp.ready() on mount.
 */
export function useTelegramWebApp(): { webApp: TelegramWebApp | null; isInTelegram: boolean } {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)

  useEffect(() => {
    const w = getWebApp()
    if (w) {
      w.ready()
      setWebApp(w)
    }
  }, [])

  return { webApp, isInTelegram: webApp !== null && !!webApp.initData }
}
