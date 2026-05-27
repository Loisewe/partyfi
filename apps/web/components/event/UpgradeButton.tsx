'use client'

import { useState } from 'react'
import { paymentsApi } from '@/lib/api-client'
import { getWebApp } from '@/lib/use-telegram-webapp'

export function UpgradeButton({
  eventId,
  isPremium,
  onUpgraded,
}: {
  eventId: string
  isPremium: boolean
  onUpgraded?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isPremium) {
    return (
      <div className="rounded-xl bg-gradient-to-r from-amber-100 to-yellow-50 border border-amber-200 px-4 py-3 text-sm">
        ⭐ <strong>Премиум-ивент</strong> · кастомный URL, безлимит фото, аналитика
      </div>
    )
  }

  async function startUpgrade() {
    const webApp = getWebApp()
    if (!webApp) {
      setError('TG Stars работают только в Telegram Mini App. Открой ивент через бота.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { invoiceUrl } = await paymentsApi.upgradeEvent(eventId)
      webApp.openInvoice(invoiceUrl, (status) => {
        if (status === 'paid') {
          webApp.HapticFeedback?.notificationOccurred('success')
          onUpgraded?.()
        } else if (status === 'failed' || status === 'cancelled') {
          webApp.HapticFeedback?.notificationOccurred('warning')
          setError(status === 'cancelled' ? null : 'Платёж не прошёл')
        }
        setLoading(false)
      })
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startUpgrade}
        disabled={loading}
        className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 font-medium text-sm disabled:opacity-50"
      >
        {loading ? 'Открываем счёт…' : '⭐ Сделать премиум · 100 Stars (~$1.30)'}
      </button>
      <p className="text-[11px] text-gray-500 mt-1.5 text-center">
        Кастомный URL · безлимит фото · аналитика
      </p>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  )
}
