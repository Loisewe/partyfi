import Link from 'next/link'

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorMessages: Record<string, string> = {
    Configuration: 'Ошибка конфигурации авторизации',
    AccessDenied: 'Доступ запрещён',
    Verification: 'Ссылка устарела',
    Default: 'Ошибка при входе',
  }

  const message = errorMessages[searchParams.error ?? 'Default'] ?? errorMessages['Default']

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-6xl">😕</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Не получилось войти</h1>
        <p className="mt-2 text-gray-500">{message}</p>
      </div>
      <Link
        href="/auth/signin"
        className="rounded-2xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition"
      >
        Попробовать снова
      </Link>
    </div>
  )
}
