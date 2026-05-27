'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PublicGuest, EventRsvpStats, RsvpVisibility } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'
import { Avatar, AvatarStack } from '@/components/ui/Avatar'

interface Props {
  tokenOrSlug: string
  pin?: string
  stats: EventRsvpStats
  visibility: RsvpVisibility
}

export function GuestList({ tokenOrSlug, pin, stats, visibility }: Props) {
  const [guests, setGuests] = useState<PublicGuest[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await eventsApi.guests(tokenOrSlug, { pin })
      setGuests(res.guests)
    } finally {
      setLoading(false)
    }
  }, [tokenOrSlug, pin])

  useEffect(() => { load() }, [load])

  const going    = guests.filter((g) => g.status === 'GOING')
  const maybe    = guests.filter((g) => g.status === 'MAYBE')
  const notGoing = guests.filter((g) => g.status === 'NOT_GOING')

  const totalWithPlusOnes = stats.going + stats.plusOnesTotal

  if (visibility === 'HOST_ONLY') {
    return (
      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-ink-900/60">🔒 Список гостей виден только хосту</p>
      </div>
    )
  }

  return (
    <div>
      {/* Stats header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold text-ink-900">
          Гости{' '}
          <span className="text-brand-500">{totalWithPlusOnes}</span>
        </h2>
        {stats.maybe + stats.notGoing > 0 && (
          <div className="text-xs text-ink-900/50">
            {stats.maybe > 0 && <span>{stats.maybe} может</span>}
            {stats.maybe > 0 && stats.notGoing > 0 && <span> · </span>}
            {stats.notGoing > 0 && <span>{stats.notGoing} не смогут</span>}
          </div>
        )}
      </div>

      {loading && <GuestSkeleton />}

      {!loading && guests.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 p-8 text-center">
          <div className="text-3xl mb-2">🦗</div>
          <p className="text-sm text-ink-900/60">Пока никто не ответил. Будь первым!</p>
        </div>
      )}

      {!loading && going.length > 0 && (
        <div className="mb-4">
          <AvatarStack
            people={going.slice(0, 7).map((g) => ({
              name: g.guest.name ?? g.guest.nickname,
              src: g.guest.avatarUrl,
              seed: g.guest.id,
            }))}
            max={7}
            size="md"
          />
          {(going.length > 7 || expanded) && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-sm font-medium text-ink-900/60 underline hover:text-ink-900"
            >
              {expanded ? 'Свернуть' : 'Показать всех'}
            </button>
          )}
        </div>
      )}

      {expanded && !loading && (
        <div className="space-y-4 animate-fade-in">
          {going.length > 0 && (
            <GuestSection title="Идут" colorClass="text-emerald-700" guests={going} />
          )}
          {maybe.length > 0 && (
            <GuestSection title="Может быть" colorClass="text-amber-700" guests={maybe} />
          )}
          {notGoing.length > 0 && (
            <GuestSection title="Не смогут" colorClass="text-ink-900/50" guests={notGoing} muted />
          )}
        </div>
      )}
    </div>
  )
}

function GuestSection({
  title,
  colorClass,
  guests,
  muted = false,
}: {
  title: string
  colorClass: string
  guests: PublicGuest[]
  muted?: boolean
}) {
  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${colorClass}`}>{title}</h3>
      <ul className="space-y-2">
        {guests.map((g) => (
          <li
            key={g.id}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${muted ? 'opacity-60' : ''}`}
          >
            <Avatar
              name={g.guest.name ?? g.guest.nickname}
              src={g.guest.avatarUrl}
              seed={g.guest.id}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">
                {g.guest.name ?? g.guest.nickname}
                {g.plusOnes > 0 && (
                  <span className="ml-2 text-xs font-normal text-ink-900/60">+{g.plusOnes}</span>
                )}
              </div>
              {g.message && (
                <div className="text-xs text-ink-900/60 italic truncate">«{g.message}»</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GuestSkeleton() {
  return (
    <div className="flex -space-x-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="w-10 h-10 rounded-full skeleton ring-2 ring-white" />
      ))}
    </div>
  )
}
