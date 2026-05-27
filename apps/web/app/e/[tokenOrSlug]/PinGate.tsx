'use client'

import { useState } from 'react'
import type { EventPinPreview } from '@wishly/shared'
import { CoverImage } from '@/components/event/CoverImage'

interface Props {
  preview: EventPinPreview
  onPinSubmit: (pin: string) => Promise<void>
}

export function PinGate({ preview, onPinSubmit }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onPinSubmit(pin)
    } catch {
      setError('Неверный PIN')
      setSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-cream-50 via-white to-white px-4 py-12">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] hero-blob pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-md animate-slide-up">
        <CoverImage
          imageUrl={preview.coverImageUrl}
          coverPresetSlug={null}
          className="w-full aspect-[16/10] rounded-3xl mb-6 shadow-lifted overflow-hidden"
        />

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
            🔒 Закрытый ивент
          </p>
          <h1 className="font-display text-display-md text-balance text-ink-900 mb-2">{preview.title}</h1>
          <p className="text-ink-900/60 mb-8">от {preview.hostName ?? 'хоста'}</p>

          <form onSubmit={submit} className="space-y-5">
            <p className="text-sm text-ink-900/70">Введи 4-значный код от хоста</p>

            <div className="flex justify-center">
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                autoFocus
                className="w-48 px-4 py-4 text-3xl text-center font-mono tracking-[0.5em] rounded-2xl border-2 border-gray-200 bg-white focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition"
                placeholder="••••"
              />
            </div>

            {error && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-900">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pin.length !== 4 || submitting}
              className="w-full px-6 py-4 bg-gradient-celebratory text-white rounded-2xl font-display font-bold text-base shadow-lifted hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? 'Открываем…' : 'Открыть ивент →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
