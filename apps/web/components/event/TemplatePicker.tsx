'use client'

import { useState } from 'react'
import { EVENT_TEMPLATES, type EventTemplate } from '@/lib/event-templates'

export function TemplatePicker({
  onPick,
  onSkip,
}: {
  onPick: (template: EventTemplate) => void
  onSkip: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-sm font-semibold text-brand-600 hover:text-brand-700"
      >
        ← Выбрать другой шаблон
      </button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
          ✨ Старт за 30 секунд
        </p>
        <h2 className="font-display text-2xl font-extrabold text-ink-900">
          Выбери шаблон
        </h2>
        <p className="text-sm text-ink-900/60 mt-1">
          Поля автоматически заполнятся — потом можно поменять
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {EVENT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onPick(t)
              setExpanded(false)
            }}
            className="group text-left p-4 rounded-2xl border border-gray-100 bg-white hover:border-brand-300 hover:shadow-soft hover:-translate-y-0.5 transition relative"
          >
            <div className="text-3xl mb-2">{t.emoji}</div>
            <div className="font-display font-bold text-ink-900 text-sm leading-tight">
              {t.title}
              {t.premium && (
                <span className="ml-1.5 text-[9px] font-bold text-amber-600 tracking-wider align-top">
                  ⭐
                </span>
              )}
            </div>
            <div className="text-xs text-ink-900/50 mt-1 leading-snug line-clamp-2">
              {t.description}
            </div>
          </button>
        ))}
      </div>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => {
            onSkip()
            setExpanded(false)
          }}
          className="text-sm text-ink-900/50 underline hover:text-ink-900/80"
        >
          Пропустить → создать с нуля
        </button>
      </div>
    </div>
  )
}
