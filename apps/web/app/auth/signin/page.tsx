import { signIn } from '@/lib/auth'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-cream-50 via-white to-white px-4 py-12 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] hero-blob pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-12 group">
          <span className="inline-block w-10 h-10 rounded-xl bg-gradient-celebratory shadow-lifted group-hover:scale-105 transition" aria-hidden />
          <span className="font-display text-3xl font-extrabold text-ink-900 tracking-tight">Partyfi</span>
        </Link>

        {/* Card */}
        <div className="rounded-3xl bg-white shadow-lifted border border-gray-100 p-8 sm:p-10">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
              Войти в аккаунт
            </p>
            <h1 className="font-display text-3xl font-bold text-ink-900 mb-2">
              С возвращением!
            </h1>
            <p className="text-sm text-ink-900/60">
              Войди, чтобы управлять ивентами и вишлистами с любого устройства
            </p>
          </div>

          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/dashboard' })
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3.5 text-sm font-semibold text-ink-900 hover:border-ink-900/30 hover:bg-gray-50 transition active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Войти через Google
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-semibold text-ink-900/40 uppercase tracking-wider">или</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <Link
            href="/"
            className="block text-center w-full rounded-2xl bg-gray-100 hover:bg-gray-200 px-4 py-3.5 text-sm font-semibold text-ink-900 transition active:scale-[0.98]"
          >
            Продолжить без аккаунта
          </Link>

          <p className="mt-1.5 text-center text-xs text-ink-900/50">
            Анонимно — но устройство забудет ивенты при очистке кеша
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-ink-900/50">
          Войдя, ты принимаешь{' '}
          <Link href="/terms" className="underline hover:text-ink-900/80">условия</Link>
          {' и '}
          <Link href="/privacy" className="underline hover:text-ink-900/80">политику конфиденциальности</Link>
        </p>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm font-medium text-ink-900/60 hover:text-ink-900">
            ← Назад на главную
          </Link>
        </div>
      </div>
    </div>
  )
}
