/**
 * Observability layer — Sentry-compatible wrapper that no-ops without DSN.
 *
 * To enable Sentry in production:
 *   1. pnpm add @sentry/nextjs
 *   2. Set NEXT_PUBLIC_SENTRY_DSN env var
 *   3. Uncomment the dynamic import block below
 *
 * For now, errors are logged to console (client) or POSTed to API (when
 * called from global-error boundary).
 */

interface ErrorContext {
  scope?: string
  userId?: string
  eventId?: string
  [key: string]: unknown
}

type SentryClient = {
  captureException(err: unknown, hint?: { extra?: Record<string, unknown> }): void
}

let sentry: SentryClient | null = null

// Hot-load Sentry if DSN configured AND package installed
async function loadSentry(): Promise<SentryClient | null> {
  if (sentry) return sentry
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return null
  try {
    // Dynamic import so missing package doesn't break the build
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mod = (await import('@sentry/nextjs' as any).catch(() => null)) as
      | (SentryClient & { init?: (opts: { dsn: string }) => void })
      | null
    if (!mod) return null
    mod.init?.({ dsn })
    sentry = mod
    return mod
  } catch {
    return null
  }
}

export function reportClientError(error: unknown, context?: ErrorContext): void {
  // Always log to console for dev visibility
  if (typeof console !== 'undefined') {
    console.error('[observability]', context?.scope ?? 'unknown', error)
  }
  // Fire-and-forget Sentry capture
  loadSentry().then((s) => {
    if (s) s.captureException(error, { extra: context as Record<string, unknown> })
  })
}

export function reportServerError(error: unknown, context?: ErrorContext): void {
  if (typeof console !== 'undefined') {
    console.error('[observability:server]', context?.scope ?? 'unknown', error)
  }
}
