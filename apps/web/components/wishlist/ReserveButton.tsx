'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createReservationSchema, type CreateReservationInput } from '@wishly/shared'
import { api } from '@/lib/api-client'

interface Props {
  itemId: string
  onReserved?: () => void
}

type Step = 'idle' | 'form' | 'success'

export function ReserveButton({ itemId, onReserved }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [loading, setLoading] = useState(false)

  const form = useForm<CreateReservationInput>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      type: 'SOLO',
      visibilityMode: 'HIDDEN_FROM_OWNER',
      allowJoining: false,
    },
  })

  async function onSubmit(data: CreateReservationInput) {
    setLoading(true)
    try {
      const result = await api.post<{ cancelToken: string }>(
        `/items/${itemId}/reserve`,
        data,
      )

      // Store cancelToken so the reserver can cancel later
      if (result.cancelToken) {
        const stored = JSON.parse(
          localStorage.getItem('wishly_cancel_tokens') ?? '{}',
        ) as Record<string, string>
        stored[itemId] = result.cancelToken
        localStorage.setItem('wishly_cancel_tokens', JSON.stringify(stored))
      }

      setStep('success')
      onReserved?.()
    } catch {
      form.setError('root', { message: 'Не удалось забронировать. Попробуй ещё раз.' })
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <span className="rounded-xl bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
        ✓ Забронировано
      </span>
    )
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('form')}
        className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition active:scale-95"
      >
        Забронировать
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center p-4"
      onClick={() => !loading && setStep('idle')}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-xl font-bold text-gray-900">Забронировать подарок</h2>
        <p className="mb-5 text-sm text-gray-500">
          Именинник не узнает, что именно ты берёшь — только что кто-то уже взял этот подарок.
        </p>

        {/* Name for anonymous */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Твоё имя
          </label>
          <input
            {...form.register('reserverDisplayName')}
            placeholder="Как тебя зовут?"
            autoFocus
            className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {/* Visibility */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium text-gray-600">
            Кто видит твоё имя?
          </label>
          <div className="flex gap-2">
            {[
              { value: 'HIDDEN_FROM_OWNER', label: 'Только гости', emoji: '🤫' },
              { value: 'PUBLIC', label: 'Все', emoji: '👀' },
            ].map((opt) => {
              const selected = form.watch('visibilityMode') === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => form.setValue('visibilityMode', opt.value as 'PUBLIC' | 'HIDDEN_FROM_OWNER')}
                  className={`flex-1 rounded-2xl border py-2 text-sm font-medium transition ${
                    selected
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Group gift */}
        <label className="mb-4 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            {...form.register('allowJoining')}
            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-300"
          />
          <span className="text-sm text-gray-700">
            Другие могут скинуться на этот подарок
          </span>
        </label>

        {form.formState.errors.root && (
          <p className="mb-3 text-sm text-red-500">{form.formState.errors.root.message}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep('idle')}
            className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-2xl bg-brand-500 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50 transition"
          >
            {loading ? 'Бронируем...' : '🎁 Беру!'}
          </button>
        </div>
      </form>
    </div>
  )
}
