'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { TemplatePicker } from '@/components/event/TemplatePicker'
import type { EventTemplate } from '@/lib/event-templates'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { eventsApi } from '@/lib/api-client'
import { CoverPresetPicker } from '@/components/event/CoverPresetPicker'
import { WishlistAttacher } from '@/components/event/WishlistAttacher'
import { PollEditor } from '@/components/event/PollEditor'
import { AgendaEditor } from '@/components/event/AgendaEditor'

// Form schema uses datetime-local (no offset) — we convert to ISO+offset on submit
const formSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(120),
  description: z.string().max(2000).optional().or(z.literal('')),
  startsAt: z.string().min(1, 'Начало обязательно'),
  endsAt: z.string().optional().or(z.literal('')),
  location: z.string().max(500).optional().or(z.literal('')),
  locationLink: z.string().url('Должна быть валидная ссылка').max(2000).optional().or(z.literal('')),
  pin: z.string().regex(/^\d{4}$/, 'PIN — 4 цифры').optional().or(z.literal('')),
  rsvpHostOnly: z.boolean().optional(),
})

type FormValues = z.infer<typeof formSchema>

function localDateTimeToIso(local: string): string {
  // datetime-local returns "2026-06-15T19:00" without timezone
  // We treat it as local time and convert to ISO with offset
  const d = new Date(local)
  return d.toISOString()
}

export function CreateEventForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [coverPresetId, setCoverPresetId] = useState<string | null>(null)
  const [wishlistId, setWishlistId] = useState<string | null>(null)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>([])
  const [agenda, setAgenda] = useState<Array<{ time?: string | null; title: string; description?: string | null }>>([])

  const [templatePicked, setTemplatePicked] = useState(false)
  const [titlePlaceholder, setTitlePlaceholder] = useState('День рождения Ани')

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { rsvpHostOnly: false },
  })

  function applyTemplate(template: EventTemplate) {
    setTemplatePicked(true)
    const d = template.defaults
    if (d.titlePlaceholder) setTitlePlaceholder(d.titlePlaceholder)
    if (d.descriptionDefault) setValue('description', d.descriptionDefault)
    if (d.pollQuestion) setPollQuestion(d.pollQuestion)
    if (d.pollOptions) setPollOptions(d.pollOptions)
    if (d.agendaDefault) {
      setAgenda(d.agendaDefault.map((a) => ({
        time: a.time ?? null,
        title: a.title,
        description: a.description ?? null,
      })))
    }
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const result = await eventsApi.create({
        title: data.title,
        description: data.description || undefined,
        startsAt: localDateTimeToIso(data.startsAt),
        endsAt: data.endsAt ? localDateTimeToIso(data.endsAt) : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: data.location || undefined,
        locationLink: data.locationLink || undefined,
        pin: data.pin || undefined,
        rsvpVisibility: data.rsvpHostOnly ? 'HOST_ONLY' : 'ALL_GUESTS',
        remindersEnabled: true,
        coverPresetId: coverPresetId ?? undefined,
        wishlistId: wishlistId ?? undefined,
        pollQuestion: pollQuestion.trim() || undefined,
        pollOptions:
          pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2
            ? pollOptions.map((o) => o.trim()).filter(Boolean)
            : undefined,
        agenda: agenda.filter((a) => a.title.trim().length > 0).length > 0
          ? agenda
              .filter((a) => a.title.trim().length > 0)
              .map((a) => ({
                time: a.time?.trim() || null,
                title: a.title.trim(),
                description: a.description?.trim() || null,
              }))
          : undefined,
      })

      if (result.editToken) {
        localStorage.setItem(`wishly_event_edit_${result.event.id}`, result.editToken)
      }
      router.push(`/e/${result.event.shareToken}/host`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Ошибка создания ивента')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:border-ink-900 focus:outline-none focus:ring-4 focus:ring-ink-900/5 transition placeholder:text-ink-900/30'
  const labelClass = 'block text-xs font-bold uppercase tracking-widest text-ink-900/60 mb-1.5'

  return (
    <div className="space-y-6">
      {!templatePicked && (
        <div className="rounded-3xl bg-white border border-gray-100 shadow-soft p-5 sm:p-6">
          <TemplatePicker
            onPick={applyTemplate}
            onSkip={() => setTemplatePicked(true)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className={labelClass}>Название *</label>
        <input
          {...register('title')}
          className={`${inputClass} font-display text-lg font-semibold`}
          placeholder={titlePlaceholder}
        />
        {errors.title && <p className="text-rose-600 text-sm mt-1.5">{errors.title.message}</p>}
      </div>

      <div>
        <label className={labelClass}>Описание</label>
        <textarea
          {...register('description')}
          rows={3}
          className={`${inputClass} resize-none`}
          placeholder="Праздничный ужин, дресс-код casual"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Начало *</label>
          <input
            {...register('startsAt')}
            type="datetime-local"
            className={inputClass}
          />
          {errors.startsAt && <p className="text-rose-600 text-sm mt-1.5">{errors.startsAt.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Конец</label>
          <input
            {...register('endsAt')}
            type="datetime-local"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>📍 Место</label>
        <input
          {...register('location')}
          className={inputClass}
          placeholder="Москва, кафе «У Ани», ул. Пушкина 10"
        />
      </div>

      <div>
        <label className={labelClass}>Ссылка на карту или Zoom</label>
        <input
          {...register('locationLink')}
          type="url"
          className={inputClass}
          placeholder="https://yandex.ru/maps/..."
        />
        {errors.locationLink && <p className="text-rose-600 text-sm mt-1.5">{errors.locationLink.message}</p>}
      </div>

      <div>
        <label className={labelClass}>🎨 Обложка</label>
        <CoverPresetPicker selectedId={coverPresetId} onChange={setCoverPresetId} />
      </div>

      <div>
        <label className={labelClass}>🎁 Вишлист (опционально)</label>
        <WishlistAttacher selectedId={wishlistId} onChange={setWishlistId} />
      </div>

      <div>
        <PollEditor
          question={pollQuestion}
          options={pollOptions}
          onQuestionChange={setPollQuestion}
          onOptionsChange={setPollOptions}
        />
      </div>

      <div>
        <AgendaEditor items={agenda} onChange={setAgenda} />
      </div>

      <details className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 group">
        <summary className="text-sm font-semibold text-ink-900 cursor-pointer flex items-center justify-between">
          <span>🔒 Приватность и доступ</span>
          <span className="text-ink-900/40 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className={labelClass}>4-значный PIN</label>
            <input
              {...register('pin')}
              inputMode="numeric"
              maxLength={4}
              className={`${inputClass} font-mono tracking-widest`}
              placeholder="0000"
            />
            <p className="text-xs text-ink-900/50 mt-1.5">Защищает от случайных прохожих по ссылке</p>
            {errors.pin && <p className="text-rose-600 text-sm mt-1.5">{errors.pin.message}</p>}
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" {...register('rsvpHostOnly')} className="mt-0.5 w-4 h-4 rounded accent-brand-500" />
            <span className="text-sm text-ink-900/80">Скрыть список гостей от других гостей <span className="text-ink-900/50">(видно только хосту)</span></span>
          </label>
        </div>
      </details>

      {serverError && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-4 bg-gradient-celebratory text-white rounded-2xl font-display font-bold text-base shadow-lifted hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
      >
        {isSubmitting ? 'Создаём…' : 'Создать ивент →'}
      </button>
      </form>
    </div>
  )
}
