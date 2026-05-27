'use client'

interface AgendaItem {
  time?: string | null
  title: string
  description?: string | null
}

interface Props {
  items: AgendaItem[]
}

/**
 * Read-only display of event agenda items (sessions, talks, sets).
 * Renders as a vertical timeline with optional time + description.
 */
export function AgendaTimeline({ items }: Props) {
  if (!items || items.length === 0) return null

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-ink-900 mb-4 flex items-center gap-2">
        <span>📋</span> Программа
        <span className="text-brand-500">{items.length}</span>
      </h2>
      <ol className="space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="relative pl-12">
            {/* Timeline dot */}
            <div className="absolute left-0 top-0 w-9 h-9 rounded-full bg-gradient-celebratory flex items-center justify-center text-white text-sm font-bold shadow-soft">
              {item.time ?? idx + 1}
            </div>
            {/* Connector line */}
            {idx < items.length - 1 && (
              <div className="absolute left-[1.0625rem] top-9 bottom-[-12px] w-0.5 bg-gradient-to-b from-brand-200 to-transparent" />
            )}
            {/* Content */}
            <div className="rounded-2xl bg-white border border-gray-100 p-3 shadow-soft">
              <p className="font-display font-bold text-ink-900 text-sm leading-tight">
                {item.title}
              </p>
              {item.description && (
                <p className="text-xs text-ink-900/60 mt-1 leading-relaxed whitespace-pre-wrap">
                  {item.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
