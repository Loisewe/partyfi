'use client'

import { useState } from 'react'

interface Props {
  question: string
  options: string[]
  onQuestionChange: (q: string) => void
  onOptionsChange: (o: string[]) => void
}

const PLACEHOLDER_OPTIONS = ['Принесу', 'Купим вместе', 'Ничего не надо']

/**
 * Tiny inline poll editor.
 * Renders a question input + N option inputs (2-6).
 * Empty out by setting question to empty string + options to [].
 */
export function PollEditor({ question, options, onQuestionChange, onOptionsChange }: Props) {
  const [enabled, setEnabled] = useState(question.length > 0 || options.length > 0)

  function enable() {
    setEnabled(true)
    if (options.length === 0) onOptionsChange(['', ''])
  }

  function disable() {
    setEnabled(false)
    onQuestionChange('')
    onOptionsChange([])
  }

  function updateOption(idx: number, value: string) {
    const next = [...options]
    next[idx] = value
    onOptionsChange(next)
  }

  function addOption() {
    if (options.length >= 6) return
    onOptionsChange([...options, ''])
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return
    onOptionsChange(options.filter((_, i) => i !== idx))
  }

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={enable}
        className="rounded-2xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50/30 p-4 text-sm text-ink-900/60 w-full text-left transition"
      >
        + Добавить опрос («что приносить?», «куда поедем?»)
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-brand-50/40 border border-brand-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-700">📊 Опрос гостям</span>
        <button type="button" onClick={disable} className="text-xs text-ink-900/50 hover:text-rose-600 underline">
          убрать
        </button>
      </div>

      <input
        value={question}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="Что принесёшь?"
        maxLength={200}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 text-sm font-medium"
      />

      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-bold w-5 text-ink-900/40">{i + 1}.</span>
            <input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={PLACEHOLDER_OPTIONS[i] ?? `Вариант ${i + 1}`}
              maxLength={80}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 text-sm"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="w-7 h-7 rounded-full text-ink-900/40 hover:text-rose-600 hover:bg-rose-50 transition"
                aria-label="Удалить"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button
            type="button"
            onClick={addOption}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 mt-1"
          >
            + ещё вариант
          </button>
        )}
      </div>

      <p className="text-xs text-ink-900/50">
        Гости отвечают одним тапом при RSVP. Хост видит сводку в реальном времени.
      </p>
    </div>
  )
}
