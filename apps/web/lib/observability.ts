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

// Hot-load Sentry if DSN configured AND package installed.
// We use Function() to construct the dynamic require so webpack does NOT try
// to resolve '@sentry/nextjs' at build time. Without this, the build fails
// when the package is not installed (which is the default — we ship without
// Sentry as a peer dep).
async function loadSentry(): Promise<SentryClient | null> {
  if (sentry) return sentry
  if (typeof window === 'undefined') return null
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<unknown>
    const mod = (await dynamicImport('@sentry/nextjs').catch(() => null)) as
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
