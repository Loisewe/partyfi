'use client'

import { useEffect } from 'react'

/**
 * Root-level error boundary. Renders <html><body> itself because the root
 * layout did not get to render. Reports to /api/v1/_client-error if reachable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Best-effort report — no observability module here because global-error
    // mounts without Providers / Toast / etc.
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
      fetch(`${apiBase}/_client-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack?.slice(0, 2000),
          digest: error.digest,
          url: typeof window !== 'undefined' ? window.location.href : '',
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      /* swallow */
    }
  }, [error])

  return (
    <html lang="ru">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 40, textAlign: 'center' }}>
        <div style={{ maxWidth: 420, margin: '80px auto' }}>
          <div style={{ fontSize: 64 }}>💥</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '20px 0 10px' }}>
            Критическая ошибка
          </h1>
          <p style={{ color: '#666', fontSize: 14 }}>
            Что-то сломалось до того, как страница успела загрузиться. Попробуй ещё раз.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 12 }}>
              id: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              borderRadius: 999,
              background: '#0f0a1e',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Попробовать ещё
          </button>
        </div>
      </body>
    </html>
  )
}
