'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/lib/observability'

/**
 * Per-segment error boundary. Catches render errors inside routes.
 * Logged to Sentry if configured (otherwise no-op).
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, { scope: 'segment-error-boundary' })
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-rose-50 via-amber-50 to-white">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="text-6xl">🥲</div>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">
          Что-то пошло не так
        </h1>
        <p className="text-ink-900/60 text-sm">
          Мы уже знаем и чиним. Можно попробовать ещё раз или вернуться на главную.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-ink-900/30">id: {error.digest}</p>
        )}
        <div className="flex gap-2 justify-center">
          <button onClick={reset} className="pill bg-ink-900 text-white text-sm">
            Попробовать ещё
          </button>
          <a href="/" className="pill bg-white border border-gray-200 text-ink-900 text-sm">
            На главную
          </a>
        </div>
      </div>
    </main>
  )
}
