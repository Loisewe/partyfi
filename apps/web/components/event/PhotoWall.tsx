'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEventStream } from '@/lib/use-event-stream'
import { Lightbox } from '@/components/ui/Lightbox'
import { useToast } from '@/components/ui/Toast'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

const PHOTO_EVENT_TYPES = ['event.photo.added', 'event.photo.removed'] as const

interface Photo {
  id: string
  url: string
  width: number
  height: number
  uploaderName: string
  createdAt: string
}

export function PhotoWall({
  eventId,
  tokenOrSlug,
  editToken,
}: {
  eventId: string
  tokenOrSlug?: string
  editToken?: string
}) {
  const toast = useToast()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/photos`)
      if (!res.ok) return
      const data = (await res.json()) as { photos: Photo[] }
      setPhotos(data.photos)
    } catch {}
  }, [eventId])

  useEffect(() => { load() }, [load])
  useEventStream(tokenOrSlug, load, PHOTO_EVENT_TYPES)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      // Upload sequentially to keep the UX simple and respect rate limits
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`${API_BASE}/events/${eventId}/photos`, {
          method: 'POST',
          body: form,
          credentials: 'include',
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(err.error ?? 'Ошибка загрузки')
        }
      }
      await load()
      toast.show(files.length === 1 ? 'Фото загружено' : `Загружено фото: ${files.length}`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка'
      setError(msg)
      toast.show(msg, 'error')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function deletePhoto(photoId: string) {
    if (!confirm('Удалить фото?')) return
    const headers: Record<string, string> = {}
    if (editToken) headers['x-edit-token'] = editToken
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/photos/${photoId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error ?? 'Не удалось удалить')
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      toast.show('Фото удалено', 'info')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка удаления'
      setError(msg)
      toast.show(msg, 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink-900 flex items-center gap-2">
            <span>📸</span> Фотостенка
            {photos.length > 0 && <span className="text-brand-500">{photos.length}</span>}
          </h2>
          {photos.length > 0 && (
            <p className="text-xs text-ink-900/50 mt-0.5">
              Тыкни в фото — откроется на весь экран
            </p>
          )}
        </div>
        <label
          className={`pill-primary cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {uploading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32 32" />
              </svg>
              Загружаем
            </>
          ) : (
            <>
              <span className="text-base leading-none">+</span> Фото
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-900">
          {error}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 p-8 text-center">
          <div className="text-4xl mb-2">📷</div>
          <p className="text-sm text-ink-900/60">
            Пока никто не выложил фото.
            <br />
            Будь первым — поделись моментом!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 stagger-parent">
          {photos.map((photo, idx) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="relative aspect-square group rounded-xl sm:rounded-2xl overflow-hidden bg-gray-100 active:scale-95 transition-transform"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Фото от ${photo.uploaderName}`}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {editToken && (
                <span
                  role="button"
                  aria-label="Удалить фото"
                  onClick={(e) => {
                    e.stopPropagation()
                    deletePhoto(photo.id)
                  }}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 hover:bg-white rounded-full w-7 h-7 text-xs flex items-center justify-center shadow text-ink-900"
                >
                  ✕
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos.map((p) => ({ id: p.id, url: p.url, uploaderName: p.uploaderName }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
