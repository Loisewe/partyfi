'use client'

import Link from 'next/link'
import { CoverImage } from '@/components/event/CoverImage'
import type { OrgSummary, OrgEvent } from '@/lib/api-client'

interface Props {
  slug: string
  initialData: {
    org: { organization: OrgSummary; owner: { name: string | null; avatarUrl: string | null }; callerRole: string | null }
    events: { events: OrgEvent[] }
  }
}

/**
 * Public organization landing — "Bandsintown for ивент-команд".
 * Shows: cover banner, name + tagline + handles, upcoming events lineup,
 * past events archive teaser. Brand color tints CTAs.
 */
export function OrgPublicView({ slug, initialData }: Props) {
  const org = initialData.org.organization
  const owner = initialData.org.owner
  const callerRole = initialData.org.callerRole
  const events = initialData.events.events

  const brand = org.brandColor ?? '#ff2d7b'
  const accent = org.accentColor ?? '#fbbf24'

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-white via-cream-50 to-white"
      style={{ ['--brand' as string]: brand, ['--accent' as string]: accent }}
    >
      {/* Cover */}
      <div className="relative h-48 sm:h-72 overflow-hidden">
        {org.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${brand} 0%, ${accent} 100%)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white/95 to-transparent" />
      </div>

      <div className="container mx-auto max-w-4xl px-4 -mt-16 relative z-10">
        {/* Header card */}
        <div className="rounded-3xl bg-white border border-gray-100 shadow-lifted p-5 sm:p-7 animate-slide-up">
          <div className="flex items-start gap-4">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-gray-100" />
            ) : (
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-display font-extrabold text-white text-2xl sm:text-3xl"
                style={{ background: `linear-gradient(135deg, ${brand} 0%, ${accent} 100%)` }}
              >
                {org.name.slice(0, 1)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink-900 tracking-tight">
                  {org.name}
                </h1>
                {org.plan !== 'FREE' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    ⭐ {org.plan.toLowerCase()}
                  </span>
                )}
              </div>
              {org.tagline && (
                <p className="text-sm text-ink-900/70 mb-2">{org.tagline}</p>
              )}
              {org.city && (
                <p className="text-xs text-ink-900/50">📍 {org.city}</p>
              )}
            </div>
            {callerRole && (
              <Link
                href={`/o/${slug}/admin`}
                className="pill bg-ink-900 text-white text-xs whitespace-nowrap"
              >
                Управление
              </Link>
            )}
          </div>

          {/* Handles */}
          {(org.websiteUrl || org.telegramHandle || org.instagramHandle || org.contactEmail) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
              {org.websiteUrl && (
                <a href={org.websiteUrl} target="_blank" rel="noopener noreferrer" className="pill bg-gray-100 hover:bg-gray-200 text-xs text-ink-900">
                  🌐 Сайт
                </a>
              )}
              {org.telegramHandle && (
                <a href={`https://t.me/${org.telegramHandle}`} target="_blank" rel="noopener noreferrer" className="pill bg-sky-100 hover:bg-sky-200 text-xs text-ink-900">
                  ✈️ @{org.telegramHandle}
                </a>
              )}
              {org.instagramHandle && (
                <a href={`https://instagram.com/${org.instagramHandle}`} target="_blank" rel="noopener noreferrer" className="pill bg-rose-100 hover:bg-rose-200 text-xs text-ink-900">
                  📷 {org.instagramHandle}
                </a>
              )}
              {org.contactEmail && (
                <a href={`mailto:${org.contactEmail}`} className="pill bg-gray-100 hover:bg-gray-200 text-xs text-ink-900">
                  ✉️ {org.contactEmail}
                </a>
              )}
            </div>
          )}

          {org.description && (
            <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-ink-900/80 whitespace-pre-wrap leading-relaxed">
              {org.description}
            </p>
          )}
        </div>

        {/* Events lineup */}
        <section className="mt-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="font-display text-2xl font-bold text-ink-900 mb-4 flex items-center gap-2">
            <span>🎟</span> Афиша
            <span style={{ color: brand }}>{events.length}</span>
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-ink-900/50 text-center py-12 rounded-2xl bg-white border border-dashed border-gray-200">
              Пока ничего не запланировано. Загляни позже 🌱
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/e/${e.customSlug ?? e.shareToken}`}
                  className="group rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-soft hover:shadow-lifted hover:-translate-y-1 transition"
                >
                  <CoverImage
                    imageUrl={e.coverImageUrl}
                    coverPresetSlug={null}
                    className="w-full aspect-[16/10] overflow-hidden"
                  />
                  <div className="p-4">
                    <div className="text-xs text-ink-900/50 mb-1">
                      {new Date(e.startsAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <h3 className="font-display font-bold text-ink-900 text-base mb-1 truncate">{e.title}</h3>
                    {e.location && (
                      <p className="text-xs text-ink-900/60 truncate">📍 {e.location}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-ink-900/60">
                      <span style={{ color: brand }} className="font-semibold">{e.rsvpStats.going} идут</span>
                      {e.rsvpStats.plusOnesTotal > 0 && (
                        <span style={{ color: brand }}>+{e.rsvpStats.plusOnesTotal}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 pt-6 border-t border-gray-100 pb-8 text-center text-xs text-ink-900/40">
          <p>Афиша создана на <Link href="/" className="underline">Event Gallery</Link> · хозяин: {owner.name ?? 'аноним'}</p>
        </footer>
      </div>
    </main>
  )
}
