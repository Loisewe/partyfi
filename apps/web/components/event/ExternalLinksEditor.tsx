'use client'

import { useState } from 'react'

export interface ExternalLink {
  emoji?: string | null
  title: string
  url: string
}

/**
 * Editor for band.link-style external links module.
 * Supports add / remove / inline emoji + title + url editing.
 * Cap enforced by parent (free=3, premium=10) via `maxLinks` prop.
 */
export function ExternalLinksEditor({
  value,
  onChange,
  maxLinks = 3,
}: {
  value: ExternalLink[]
  onChange: (next: ExternalLink[]) => void
  maxLinks?: number
}) {
  const [expanded, setExpanded] = useState(value.length > 0)

  function update(idx: number, patch: Partial<ExternalLink>) {
    const next = value.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    onChange(next)
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }
  function add() {
    if (value.length >= maxLinks) return
    onChange([...value, { emoji: '🔗', title: '', url: '' }])
    setExpanded(true)
  }

  if (!expanded && value.length === 0) {
    return (
      <button
        type="button"
        onClick={() => { setExpanded(true); add() }}
        className="text-sm font-semibold text-brand-600 hover:text-brand-700"
      >
        + Добавить ссылки (плейлист, чат, меню...)
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {value.map((link, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <input
            value={link.emoji ?? ''}
            onChange={(e) => update(idx, { emoji: e.target.value.slice(0, 4) || null })}
            placeholder="🔗"
            className="w-12 text-center text-xl rounded-xl border border-gray-200 px-1 py-2 bg-white"
            aria-label="Эмодзи"
          />
          <div className="flex-1 space-y-1.5">
            <input
              value={link.title}
              onChange={(e) => update(idx, { title: e.target.value })}
              placeholder="Spotify-плейлист"
              maxLength={60}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
            />
            <input
              type="url"
              value={link.url}
              onChange={(e) => update(idx, { url: e.target.value })}
              placeholder="https://open.spotify.com/playlist/…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs bg-white font-mono"
            />
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-xs font-semibold text-ink-900/50 hover:text-rose-600 px-2 pt-2"
            aria-label="Удалить"
          >
            ✕
          </button>
        </div>
      ))}
      {value.length < maxLinks ? (
        <button
          type="button"
          onClick={add}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          + Добавить ссылку ({value.length}/{maxLinks})
        </button>
      ) : (
        <p className="text-xs text-ink-900/50">
          Лимит — {maxLinks} {maxLinks === 3 ? 'ссылки. Премиум — до 10.' : 'ссылок.'}
        </p>
      )}
    </div>
  )
}
