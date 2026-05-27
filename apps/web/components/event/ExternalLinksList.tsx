'use client'

import { useState } from 'react'

interface ExternalLink {
  emoji?: string | null
  title: string
  url: string
}

/**
 * band.link-style external links displayed as stacked cards on event page.
 * Each link opens in new tab. Host-configured per event (3 free / 10 premium).
 */
export function ExternalLinksList({ links }: { links: ExternalLink[] }) {
  const [clicked, setClicked] = useState<string | null>(null)

  if (!links || links.length === 0) return null

  return (
    <div className="space-y-2">
      {links.map((link, idx) => {
        const key = `${link.url}-${idx}`
        const domain = safeHostname(link.url)
        const isHot = clicked === key
        return (
          <a
            key={key}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setClicked(key)}
            className={`group flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-3 sm:p-4 shadow-soft hover:shadow-lifted hover:-translate-y-0.5 transition ${
              isHot ? 'border-brand-200' : ''
            }`}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-brand-100 to-amber-100 flex items-center justify-center text-2xl flex-shrink-0">
              {link.emoji || '🔗'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink-900 truncate">{link.title}</div>
              <div className="text-xs text-ink-900/50 truncate">{domain}</div>
            </div>
            <div className="text-ink-900/40 group-hover:text-brand-500 group-hover:translate-x-1 transition text-lg">
              →
            </div>
          </a>
        )
      })}
    </div>
  )
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
