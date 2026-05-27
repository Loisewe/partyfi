'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRsvpSchema, type CreateRsvpInput, type RsvpStatus } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'

interface Props {
  tokenOrSlug: string
  pin?: string
  pollQuestion?: string | null
  pollOptions?: string[] | null
}

interface StatusButton {
  status: RsvpStatus
  emoji: string
  label: string
  /** Tailwind classes applied when selected */
  selectedClass: string
  /** Color used on the selection ring */
  ringClass: string
}

const STATUS_BUTTONS: StatusButton[] = [
  { status: 'GOING',     emoji: '🎉', label: 'Иду',         selectedClass: 'bg-gradient-celebratory text-white border-transparent shadow-lifted', ringClass: 'ring-brand-500/30' },
  { status: 'MAYBE',     emoji: '🤔', label: 'Может быть',  selectedClass: 'bg-amber-100 text-amber-900 border-amber-300', ringClass: 'ring-amber-300/40' },
  { status: 'NOT_GOING', emoji: '😔', label: 'Не смогу',    selectedClass: 'bg-gray-900 text-white border-gray-900', ringClass: 'ring-gray-400/30' },
]

const SUCCESS_COPY: Record<RsvpStatus, { headline: string; sub: string; bg: string }> = {
  GOING: {
    headline: 'Ура! Ты в списке',
    sub: 'Мы напомним за день и за два часа до начала.',
    bg: 'bg-gradient-to-br from-brand-50 to-cream-100',
  },
  MAYBE: {
    headline: 'Понятно, ты под вопросом',
    sub: 'Можно поменять решение в любой момент.',
    bg: 'bg-gradient-to-br from-amber-50 to-cream-100',
  },
  NOT_GOING: {
    headline: 'Жаль! Но спасибо что ответил',
    sub: 'Хост увидит и не будет ждать.',
    bg: 'bg-gradient-to-br from-gray-50 to-white',
  },
}

export function RsvpForm({ tokenOrSlug, pin, pollQuestion, pollOptions }: Props) {
  const toast = useToast()
  const [submittedStatus, setSubmittedStatus] = useState<RsvpStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelToken, setCancelToken] = useState<string | undefined>()
  const [showExtras, setShowExtras] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(`wishly_rsvp_${tokenOrSlug}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { token: string; status: RsvpStatus }
        setCancelToken(parsed.token)
        setSubmittedStatus(parsed.status)
      } catch {
        /* malformed */
      }
    }
  }, [tokenOrSlug])

  const { register, handleSubmit, setValue, watch } = useForm<CreateRsvpInput>({
    resolver: zodResolver(createRsvpSchema),
    defaultValues: { status: 'GOING', plusOnes: 0 },
  })

  const currentStatus = watch('status')
  const currentPlusOnes = watch('plusOnes') ?? 0
  const currentPollAnswer = watch('pollAnswer')

  const showPoll = !!pollQuestion && Array.isArray(pollOptions) && pollOptions.length >= 2

  async function onSubmit(data: CreateRsvpInput) {
    setError(null)
    try {
      const res = await eventsApi.rsvp(tokenOrSlug, data, { pin })
      if (res.rsvp.cancelToken) {
        localStorage.setItem(
          `wishly_rsvp_${tokenOrSlug}`,
          JSON.stringify({ token: res.rsvp.cancelToken, status: res.rsvp.status }),
        )
        setCancelToken(res.rsvp.cancelToken)
      }
      setSubmittedStatus(res.rsvp.status)
      toast.show('Ответ отправлен', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка отправки'
      setError(msg)
      toast.show(msg, 'error')
    }
  }

  async function cancelRsvp() {
    try {
      await eventsApi.cancelRsvp(tokenOrSlug, cancelToken)
      localStorage.removeItem(`wishly_rsvp_${tokenOrSlug}`)
      setCancelToken(undefined)
      setSubmittedStatus(null)
      toast.show('Ответ отменён', 'info')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка отмены'
      setError(msg)
      toast.show(msg, 'error')
    }
  }

  if (submittedStatus) {
    const copy = SUCCESS_COPY[submittedStatus]
    return (
      <div className={`rounded-3xl ${copy.bg} p-6 sm:p-8 animate-slide-up`}>
        <div className="flex items-start gap-4">
          <div className="text-5xl shrink-0 leading-none">
            {STATUS_BUTTONS.find((b) => b.status === submittedStatus)?.emoji}
          </div>
          <div className="flex-1">
            <h3 className="font-display text-2xl font-bold text-ink-900 mb-1">{copy.headline}</h3>
            <p className="text-sm text-ink-900/70">{copy.sub}</p>
            <button
              onClick={cancelRsvp}
              className="mt-4 text-sm font-medium text-ink-900/60 underline hover:text-ink-900 transition"
            >
              Передумать
            </button>
          </div>
        </div>
        {error && <p className="text-rose-600 text-sm mt-3">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <h2 className="font-display text-2xl font-bold text-ink-900">Ваш ответ</h2>

      {/* Status pills */}
      <div>
        <div className="grid grid-cols-3 gap-2">
          {STATUS_BUTTONS.map((btn) => {
            const isSelected = currentStatus === btn.status
            return (
              <button
                key={btn.status}
                type="button"
                onClick={() => setValue('status', btn.status, { shouldDirty: true })}
                className={`relative flex flex-col items-center gap-1 py-4 px-2 rounded-2xl border-2 transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? `${btn.selectedClass} ring-4 ${btn.ringClass}`
                    : 'border-gray-200 bg-white text-ink-900/70 hover:border-ink-900/30 hover:-translate-y-0.5'
                }`}
              >
                <span className="text-2xl leading-none">{btn.emoji}</span>
                <span className="text-xs font-semibold">{btn.label}</span>
              </button>
            )
          })}
        </div>
        <input type="hidden" {...register('status')} />
      </div>

      {/* Plus-ones stepper (only if GOING) */}
      {currentStatus === 'GOING' && (
        <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 animate-fade-in">
          <div className="text-sm">
            <div className="font-semibold text-ink-900">С кем-то ещё?</div>
            <div className="text-xs text-ink-900/60">Сколько друзей приведёшь</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setValue('plusOnes', Math.max(0, currentPlusOnes - 1))}
              disabled={currentPlusOnes === 0}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 text-lg font-bold disabled:opacity-30 active:scale-90 transition"
              aria-label="Минус один"
            >
              −
            </button>
            <span className="w-8 text-center font-display text-xl font-bold tabular-nums">
              {currentPlusOnes === 0 ? '0' : `+${currentPlusOnes}`}
            </span>
            <button
              type="button"
              onClick={() => setValue('plusOnes', Math.min(10, currentPlusOnes + 1))}
              disabled={currentPlusOnes === 10}
              className="w-9 h-9 rounded-full bg-ink-900 text-white text-lg font-bold disabled:opacity-30 active:scale-90 transition"
              aria-label="Плюс один"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Poll — if event has pollQuestion */}
      {showPoll && (
        <div className="rounded-2xl bg-brand-50/40 border border-brand-100 p-4 animate-fade-in">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700 mb-2">📊 Опрос от хоста</p>
          <p className="font-display font-semibold text-ink-900 mb-3">{pollQuestion}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pollOptions!.map((opt) => {
              const isSelected = currentPollAnswer === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setValue('pollAnswer', opt, { shouldDirty: true })}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition active:scale-95 ${
                    isSelected
                      ? 'bg-brand-500 text-white shadow-soft'
                      : 'bg-white border border-gray-200 text-ink-900 hover:border-brand-300'
                  }`}
                >
                  {isSelected && '✓ '}{opt}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Collapsible extras */}
      {!showExtras ? (
        <button
          type="button"
          onClick={() => setShowExtras(true)}
          className="text-sm font-medium text-ink-900/60 underline hover:text-ink-900"
        >
          + Добавить имя или комментарий
        </button>
      ) : (
        <div className="space-y-3 animate-fade-in">
          <div>
            <label className="block text-xs font-semibold text-ink-900/60 mb-1.5 uppercase tracking-wide">
              Имя (если без аккаунта)
            </label>
            <input
              {...register('guestDisplayName')}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-ink-900 focus:outline-none focus:ring-4 focus:ring-ink-900/5 transition"
              placeholder="Аня"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-900/60 mb-1.5 uppercase tracking-wide">
              Комментарий хосту
            </label>
            <textarea
              {...register('message')}
              rows={2}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-ink-900 focus:outline-none focus:ring-4 focus:ring-ink-900/5 transition resize-none"
              placeholder="Принесу торт"
              maxLength={500}
            />
          </div>
        </div>
      )}

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <button
        type="submit"
        className="w-full px-6 py-4 bg-gradient-celebratory text-white rounded-2xl font-display font-bold text-base shadow-lifted hover:shadow-lifted hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
      >
        Отправить ответ →
      </button>
    </form>
  )
}
