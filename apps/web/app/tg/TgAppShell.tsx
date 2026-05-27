'use client'

import { useTelegramAuth } from '@/lib/use-telegram-auth'
import { useTelegramWebApp } from '@/lib/use-telegram-webapp'
import { useEffect } from 'react'

export function TgAppShell({ children }: { children: React.ReactNode }) {
  const auth = useTelegramAuth()
  const { webApp } = useTelegramWebApp()

  useEffect(() => {
    if (webApp) {
      try {
        webApp.expand()
      } catch {}
    }
  }, [webApp])

  if (auth.status === 'unavailable') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-2">Открой в Telegram</h1>
          <p className="text-sm text-gray-600">
            Эта страница работает внутри Telegram Mini App. Найди бота @YourBot и открой ивент оттуда.
          </p>
        </div>
      </main>
    )
  }

  if (auth.status === 'authenticating' || auth.status === 'idle') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">Подключаемся к Telegram…</div>
      </main>
    )
  }

  if (auth.status === 'failed') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-2 text-red-600">Не удалось войти</h1>
          <p className="text-sm text-gray-600">{auth.error}</p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
