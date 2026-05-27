'use client'

interface AgendaItem {
  time?: string | null
  title: string
  description?: string | null
}

interface Props {
  items: AgendaItem[]
  onChange: (next: AgendaItem[]) => void
}

export function AgendaEditor({ items, onChange }: Props) {
  function add() {
    if (items.length >= 30) return
    onChange([...items, { time: '', title: '' }])
  }

  function update(idx: number, patch: Partial<AgendaItem>) {
    const next = [...items]
    next[idx] = { ...next[idx]!, ...patch }
    onChange(next)
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx))
  }

  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={add}
        className="w-full rounded-2xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50/30 p-4 text-sm text-ink-900/60 text-left transition"
      >
        + Добавить программу (лекции, сеты, расписание)
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-violet-50/40 border border-violet-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-violet-700">📋 Программа</span>
        <button type="button" onClick={() => onChange([])} className="text-xs text-ink-900/50 hover:text-rose-600 underline">
          убрать
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{2}:\d{2}"
              value={item.time ?? ''}
              onChange={(e) => update(i, { time: e.target.value || null })}
              placeholder="19:00"
              className="w-16 shrink-0 px-2 py-2 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 text-xs font-mono text-center"
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                value={item.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Название блока"
                maxLength={120}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 text-sm font-medium"
              />
              <textarea
                value={item.description ?? ''}
                onChange={(e) => update(i, { description: e.target.value || null })}
                placeholder="Описание (опционально)"
                rows={2}
                maxLength={500}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 text-xs resize-none"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 w-7 h-7 rounded-full text-ink-900/40 hover:text-rose-600 hover:bg-rose-50 transition"
              aria-label="Удалить"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {items.length < 30 && (
        <button type="button" onClick={add} className="text-xs font-semibold text-violet-700 hover:text-violet-800">
          + ещё блок
        </button>
      )}
    </div>
  )
}
