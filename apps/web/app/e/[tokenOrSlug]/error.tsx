'use client'

import { useEffect } from 'react'

export default function EventError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[event-page error]', error)
  }, [error])

  return (
    <main className="container mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-2">Что-то пошло не так</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Мы не смогли загрузить этот ивент. Возможно, проблема временная.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-black text-white rounded-lg text-sm"
      >
        Попробовать снова
      </button>
      <a href="/" className="block mt-4 text-sm text-gray-500 underline">
        На главную
      </a>
    </main>
  )
}
