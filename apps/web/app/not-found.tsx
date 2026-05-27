import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center px-4">
      <div className="text-7xl">🎁</div>
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">Страница не найдена</h1>
        <p className="mt-2 text-gray-500">
          Возможно, вишлист был удалён или ссылка неверная
        </p>
      </div>
      <Link
        href="/"
        className="rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition"
      >
        Создать свой вишлист
      </Link>
    </div>
  )
}
