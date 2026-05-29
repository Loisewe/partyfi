'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { orgsApi, type OrgWithRole } from '@/lib/api-client'

/**
 * Dropdown showing user's organizations.
 * Quick navigation to /o/[slug]/admin + "Create new organization" CTA.
 * Hidden when user has no JWT token.
 */
export function OrgSwitcher() {
  const [orgs, setOrgs] = useState<OrgWithRole[]>([])
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [hasAuth, setHasAuth] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('wishly_access_token')
    setHasAuth(!!token)
    if (!token) {
      setLoaded(true)
      return
    }
    orgsApi.mine()
      .then((d) => { setOrgs(d.organizations); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!hasAuth || !loaded) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-sm font-semibold text-ink-900 transition"
      >
        <span>🏢</span>
        <span className="hidden sm:inline">
          {orgs.length === 0 ? 'Команды' : `${orgs.length} ${pluralize(orgs.length)}`}
        </span>
        <svg className="w-3 h-3 ml-0.5" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white border border-gray-100 shadow-lifted overflow-hidden z-30 animate-slide-up">
          {orgs.length > 0 && (
            <ul className="max-h-80 overflow-y-auto">
              {orgs.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/o/${o.slug}/admin`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    {o.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.logoUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{
                          background: `linear-gradient(135deg, ${o.brandColor ?? '#ff2d7b'} 0%, ${o.accentColor ?? '#fbbf24'} 100%)`,
                        }}
                      >
                        {o.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-900 truncate">{o.name}</div>
                      <div className="text-[10px] text-ink-900/50">
                        {o.role.toLowerCase()} · {o.plan.toLowerCase()}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {orgs.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-900/50">
              У тебя пока нет организаций.
            </p>
          )}
          <Link
            href="/orgs/new"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition"
          >
            <span className="text-lg leading-none">+</span> Создать организацию
          </Link>
        </div>
      )}
    </div>
  )
}

function pluralize(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'команда'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'команды'
  return 'команд'
}
