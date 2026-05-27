'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import { CreateWishlistButton } from '@/components/wishlist/CreateWishlistButton'

interface HeaderProps {
  showCreate?: boolean
}

export function Header({ showCreate = false }: HeaderProps) {
  const { data: session, status } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-1.5 group">
          <span className="inline-block w-7 h-7 rounded-lg bg-gradient-celebratory shadow-sm group-hover:scale-105 transition" aria-hidden />
          <span className="font-display text-xl font-extrabold text-ink-900 tracking-tight">Event Gallery</span>
        </Link>

        <div className="flex items-center gap-3">
          {showCreate && <CreateWishlistButton />}

          {status === 'loading' && (
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-100" />
          )}

          {status === 'authenticated' && session.user && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full hover:opacity-80 transition"
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-brand-400 to-violet-500">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name ?? 'User'}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-sm font-bold text-white">
                      {(session.user.name ?? 'U')[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="hidden text-sm font-medium text-gray-700 sm:block">
                  {session.user.name?.split(' ')[0]}
                </span>
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-10 z-20 w-48 rounded-2xl bg-white py-1 shadow-xl ring-1 ring-gray-100">
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      🎁 Мои вишлисты
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      ⚙️ Настройки
                    </Link>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        signOut({ callbackUrl: '/' })
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50"
                    >
                      Выйти
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {status === 'unauthenticated' && (
            <Link
              href="/auth/signin"
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
