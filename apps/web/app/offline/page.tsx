export const metadata = { title: 'Нет интернета · Event Gallery' }

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-gradient-to-b from-rose-50 via-amber-50/40 to-white">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">📡</div>
        <h1 className="font-display text-3xl font-extrabold text-ink-900 mb-2">
          Нет интернета
        </h1>
        <p className="text-ink-900/70 mb-6">
          Похоже что соединение пропало. Когда вернётся — всё восстановится автоматически.
        </p>
        <button
          onClick={() => location.reload()}
          className="pill bg-ink-900 text-white text-sm"
        >
          Попробовать снова
        </button>
      </div>
    </main>
  )
}
