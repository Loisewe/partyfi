import Link from 'next/link'
import { TelegramLoginButton } from './TelegramLoginButton'

export const metadata = {
  title: 'Войти · Event Gallery',
}

export default function SignInPage() {
  const botName = process.env.NEXT_PUBLIC_TG_BOT_NAME ?? 'event_gallery_bot'

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-cream-50 via-white to-white px-4 py-12 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] hero-blob pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-12 group">
          <span className="inline-block w-10 h-10 rounded-xl bg-gradient-celebratory shadow-lifted group-hover:scale-105 transition" aria-hidden />
          <span className="font-display text-3xl font-extrabold text-ink-900 tracking-tight">Event Gallery</span>
        </Link>

        {/* Card */}
        <div className="rounded-3xl bg-white shadow-lifted border border-gray-100 p-8 sm:p-10">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
              Войти через Telegram
            </p>
            <h1 className="font-display text-3xl font-bold text-ink-900 mb-2">
              С возвращением!
            </h1>
            <p className="text-sm text-ink-900/60">
              Один тап — и Telegram-аккаунт станет твоей Event Gallery&nbsp;учёткой.
            </p>
          </div>

          <TelegramLoginButton botName={botName} />

          <p className="mt-4 text-center text-xs text-ink-900/50">
            Мы получим: имя, юзернейм и аватарку. Доступ к чатам — нет.
          </p>

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
            Анонимно — устройство забудет ивенты при очистке кеша
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
