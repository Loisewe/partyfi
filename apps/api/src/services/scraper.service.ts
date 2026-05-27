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

export async function scrapeUrl(url: string, redis: RedisWrapper): Promise<ScrapedData> {
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
