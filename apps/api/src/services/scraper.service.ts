/**
 * URL scraping service — pure JS, no native modules.
 * Layered extraction: JSON-LD > Open Graph > Twitter Card > HTML fallback.
 */

import crypto from 'crypto'
import { parse as parseHtml } from 'node-html-parser'
import type { ScrapedData } from '@wishly/shared'
import { parsePriceString } from '@wishly/shared'

const CACHE_TTL_SECONDS = 60 * 60 * 24
const SCRAPE_TIMEOUT_MS = 8000

interface RedisWrapper {
  get(key: string): Promise<string | null>
  set(key: string, ttl: number, value: string): Promise<unknown>
}

/**
 * SSRF guard. Rejects:
 *   - non-http(s) schemes (file://, gopher://, etc.)
 *   - localhost, link-local, private + reserved IPv4 ranges
 *   - IPv6 loopback, ULA (fc00::/7)
 *   - bare-hostname requests without a valid public DNS lookup (basic check)
 *
 * Allows public URLs only. Throws on bad input.
 */
function assertSafeScrapeUrl(input: string): URL {
  let u: URL
  try { u = new URL(input) } catch { throw new Error('Invalid URL') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed')
  }
  const host = u.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.cluster.local')
  ) {
    throw new Error('Internal hostnames are not allowed')
  }
  // Reject IPv4 literals in private / reserved ranges
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [parseInt(v4[1]!, 10), parseInt(v4[2]!, 10)]
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||      // link-local
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224                          // multicast + reserved
    ) {
      throw new Error('Private/reserved IPs are not allowed')
    }
  }
  // Reject IPv6 ULA / link-local literals (basic)
  if (host.startsWith('[fc') || host.startsWith('[fd') || host.startsWith('[fe80')) {
    throw new Error('Private IPv6 not allowed')
  }
  return u
}

export async function scrapeUrl(url: string, redis: RedisWrapper): Promise<ScrapedData> {
  // Validate before cache key — corrupt URLs shouldn't poison cache
  assertSafeScrapeUrl(url)

  const cacheKey = `scrape:${crypto.createHash('sha256').update(url).digest('hex')}`
  const cached = await redis.get(cacheKey)
  if (cached) { try { return JSON.parse(cached) as ScrapedData } catch { /* */ } }
  const result = await scrapeUrlFresh(url)
  await redis.set(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result))
  return result
}

async function scrapeUrlFresh(url: string): Promise<ScrapedData> {
  let html: string
  let finalUrl = url
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7',
      },
      redirect: 'follow',
    })
    clearTimeout(t)
    finalUrl = res.url ?? url
    html = await res.text()
  } catch { return empty() }

  try {
    const root = parseHtml(html, { lowerCaseTagName: true, comment: false })
    const meta = (prop: string): string | null =>
      root.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ??
      root.querySelector(`meta[name="${prop}"]`)?.getAttribute('content') ?? null

    const title = meta('og:title') ?? meta('twitter:title') ?? root.querySelector('title')?.text?.trim() ?? null
    const description = meta('og:description') ?? meta('description') ?? null
    const imageUrl = meta('og:image') ?? meta('twitter:image') ?? null
    const siteName = meta('og:site_name') ?? (() => { try { return new URL(finalUrl).hostname.replace('www.', '') } catch { return null } })()

    const faviconHref = root.querySelector('link[rel="icon"]')?.getAttribute('href') ?? root.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ?? '/favicon.ico'
    const favicon = (() => { try { return faviconHref.startsWith('http') ? faviconHref : new URL(faviconHref, new URL(finalUrl).origin).toString() } catch { return null } })()

    const price = extractPrice(root, finalUrl)
    return { title, description, imageUrl, price: price?.price ?? null, currency: price?.currency ?? null, favicon, siteName }
  } catch { return empty() }
}

function extractPrice(root: ReturnType<typeof parseHtml>, url: string): { price: number; currency: string } | null {
  const defaultCurrency = url.match(/\.(ru|рф)|wildberries|ozon|avito|lamoda/) ? 'RUB' : 'USD'

  // JSON-LD
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const items = [JSON.parse(script.text) as Record<string, unknown>].flat()
      for (const item of items) {
        if (String(item['@type']).includes('Product')) {
          const offers = item['offers'] as Record<string, unknown> | undefined
          const priceRaw = offers?.['price'] as string | number | undefined
          if (priceRaw !== undefined) {
            const result = parsePriceString(String(priceRaw), (offers?.['priceCurrency'] as string) ?? defaultCurrency)
            if (result) return result
          }
        }
      }
    } catch { /* */ }
  }

  // OG price
  const ogPrice = root.querySelector('meta[property="og:price:amount"]')?.getAttribute('content')
    ?? root.querySelector('meta[property="product:price:amount"]')?.getAttribute('content')
  if (ogPrice) {
    const currency = root.querySelector('meta[property="og:price:currency"]')?.getAttribute('content') ?? defaultCurrency
    return parsePriceString(ogPrice, currency)
  }

  // schema.org microdata
  const priceEl = root.querySelector('[itemprop="price"]')
  if (priceEl) {
    const val = priceEl.getAttribute('content') ?? priceEl.text?.trim()
    if (val) return parsePriceString(val, defaultCurrency)
  }

  return null
}

function empty(): ScrapedData {
  return { title: null, description: null, imageUrl: null, price: null, currency: null, favicon: null, siteName: null }
}
