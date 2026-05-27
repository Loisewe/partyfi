'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'

/**
 * Host-only embed code generator. Shows an <iframe> snippet for the event
 * with auto-resize JS. Copy-to-clipboard button.
 */
export function EmbedCodeBox({ shareToken, customSlug }: { shareToken: string; customSlug: string | null }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const tokenOrSlug = customSlug ?? shareToken
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://partyfi.app'

  const embedSrc = `${origin}/embed/${tokenOrSlug}`

  const snippet = `<iframe
  src="${embedSrc}"
  style="border:0;width:100%;max-width:420px;display:block;margin:0 auto"
  height="640"
  loading="lazy"
  allow="clipboard-write"
  title="Партифи-карточка ивента"
></iframe>
<script>
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'partyfi:resize') return
  var f = document.querySelector('iframe[src*="${origin}/embed/"]')
  if (f && e.data.height) f.style.height = e.data.height + 'px'
})
</script>`

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      toast.show('Код embed скопирован', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.show('Не получилось скопировать', 'error')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-900/60">
        Вставь iframe на свой сайт/блог. Высота подстраивается автоматически через postMessage.
      </p>
      <textarea
        readOnly
        value={snippet}
        rows={9}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-[11px] font-mono leading-relaxed"
      />
      <button
        onClick={copy}
        className="pill bg-ink-900 text-white text-sm w-full"
      >
        {copied ? '✓ Скопировано' : 'Скопировать код'}
      </button>
    </div>
  )
}
