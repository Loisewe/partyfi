/* Partyfi service worker — minimal offline shell + static cache */

const CACHE = 'partyfi-v1'
const OFFLINE_URL = '/offline'

const PRECACHE = [
  '/',
  '/offline',
  '/favicon.svg',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // Best-effort precache — if any URL fails (e.g. /offline before build),
      // skip it rather than failing the whole install.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => {
            /* skip */
          }),
        ),
      )
      self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Skip cross-origin (TG API, R2, OG generation cross-host, etc.)
  if (url.origin !== self.location.origin) return

  // Skip API calls
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/og/')) return

  // Cache-first for Next.js static chunks
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req))
    return
  }

  // Network-first for HTML with offline fallback
  const accept = req.headers.get('accept') ?? ''
  if (accept.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(req))
    return
  }

  // Default: cache-first
  event.respondWith(cacheFirst(req))
})

async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch {
    return cached ?? Response.error()
  }
}

async function networkFirstWithOfflineFallback(req) {
  try {
    const res = await fetch(req)
    if (res.ok) {
      const cache = await caches.open(CACHE)
      cache.put(req, res.clone())
    }
    return res
  } catch {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    if (cached) return cached
    const offline = await cache.match(OFFLINE_URL)
    if (offline) return offline
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}
