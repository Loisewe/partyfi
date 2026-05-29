import { Suspense } from 'react'
import { TelegramCallbackClient } from './TelegramCallbackClient'

export const metadata = { title: 'Авторизация…' }

export default function TelegramCallbackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TelegramCallbackClient />
    </Suspense>
  )
}

function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cream-50 via-white to-white">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-celebratory animate-pulse" />
        <p className="text-sm text-ink-900/60">Заходим в Event Gallery…</p>
      </div>
    </main>
  )
}
