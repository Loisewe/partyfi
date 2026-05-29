'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { orgsApi, type OrgSummary, type OrgMember, type OrgEvent } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'

type Tab = 'overview' | 'events' | 'team' | 'brand' | 'billing'

export function OrgAdminShell({ slug }: { slug: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [org, setOrg] = useState<OrgSummary | null>(null)
  const [callerRole, setCallerRole] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])

  const loadOrg = useCallback(async () => {
    try {
      const data = await orgsApi.get(slug)
      setOrg(data.organization)
      setCallerRole(data.callerRole)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить')
    }
  }, [slug])

  useEffect(() => { loadOrg() }, [loadOrg])

  useEffect(() => {
    if (!org) return
    if (tab === 'events' || tab === 'overview') {
      orgsApi.events(slug, 'upcoming').then((d) => setEvents(d.events)).catch(() => {})
    }
    if (tab === 'team' && callerRole && ['OWNER', 'ADMIN', 'EDITOR'].includes(callerRole)) {
      orgsApi.members(org.id).then((d) => setMembers(d.members)).catch(() => {})
    }
  }, [tab, org, slug, callerRole])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-rose-600">{error}</p>
          <Link href="/" className="pill bg-ink-900 text-white text-sm">На главную</Link>
        </div>
      </main>
    )
  }
  if (!org) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-celebratory animate-pulse" />
      </main>
    )
  }
  if (!callerRole) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="max-w-md space-y-3">
          <div className="text-5xl">🔒</div>
          <h1 className="font-display text-2xl font-bold">Ты не в команде</h1>
          <p className="text-sm text-ink-900/60">
            Чтобы управлять «{org.name}», тебя должен пригласить владелец или админ.
          </p>
          <Link href={`/o/${slug}`} className="pill bg-ink-900 text-white text-sm inline-flex">
            Открыть как гость
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-cream-50 via-white to-white pb-12">
      <div className="container mx-auto max-w-5xl px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <Link href={`/o/${slug}`} className="text-sm text-ink-900/60 hover:text-ink-900">
            ← Открыть как гость
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-ink-900/40">
            твоя роль: {callerRole}
          </span>
        </div>

        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-1">Управление</p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink-900 tracking-tight">
            {org.name}
          </h1>
          {org.tagline && <p className="text-sm text-ink-900/60 mt-1">{org.tagline}</p>}
        </header>

        <nav className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
          {(['overview', 'events', 'team', 'brand', 'billing'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
                tab === t
                  ? 'border-ink-900 text-ink-900'
                  : 'border-transparent text-ink-900/50 hover:text-ink-900'
              }`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </nav>

        {tab === 'overview' && <OverviewTab org={org} events={events} />}
        {tab === 'events' && <EventsTab slug={slug} events={events} />}
        {tab === 'team' && <TeamTab org={org} members={members} callerRole={callerRole} onReload={() => orgsApi.members(org.id).then((d) => setMembers(d.members))} />}
        {tab === 'brand' && <BrandTab org={org} onUpdated={loadOrg} />}
        {tab === 'billing' && <BillingTab org={org} />}
      </div>
    </main>
  )
}

function tabLabel(t: Tab): string {
  return { overview: 'Обзор', events: 'Ивенты', team: 'Команда', brand: 'Бренд', billing: 'Подписка' }[t]
}

function OverviewTab({ org, events }: { org: OrgSummary; events: OrgEvent[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard label="План" value={org.plan} />
      <StatCard label="Предстоящих ивентов" value={String(events.length)} />
      <StatCard label="Слаг" value={`/o/${org.slug}`} />
      <StatCard label="Публичная" value={org.isPublic ? 'да' : 'нет'} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-900/50">{label}</div>
      <div className="font-display text-lg font-bold text-ink-900 mt-1 truncate">{value}</div>
    </div>
  )
}

function EventsTab({ slug, events }: { slug: string; events: OrgEvent[] }) {
  return (
    <div className="space-y-3">
      <Link
        href={`/create-event?organizationSlug=${slug}`}
        className="block w-full pill bg-gradient-celebratory text-white text-sm py-3 text-center shadow-soft"
      >
        + Новый ивент под этой организацией
      </Link>
      {events.length === 0 ? (
        <p className="text-sm text-ink-900/50 text-center py-12 rounded-2xl bg-white border border-dashed border-gray-200">
          Ещё нет ивентов
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-3">
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-ink-900 truncate">{e.title}</div>
                <div className="text-xs text-ink-900/50">
                  {new Date(e.startsAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <Link href={`/e/${e.customSlug ?? e.shareToken}/host`} className="pill bg-ink-900 text-white text-xs">
                Управлять
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TeamTab({
  org,
  members,
  callerRole,
  onReload,
}: {
  org: OrgSummary
  members: OrgMember[]
  callerRole: string | null
  onReload: () => void
}) {
  const toast = useToast()
  const canInvite = callerRole === 'OWNER' || callerRole === 'ADMIN'

  async function invite() {
    try {
      const res = await orgsApi.inviteMember(org.id, { role: 'EDITOR' })
      if (res.invite) {
        await navigator.clipboard.writeText(res.invite.url)
        toast.show('Ссылка-приглашение скопирована', 'success')
        onReload()
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не получилось', 'error')
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 p-3">
            <div className="w-10 h-10 rounded-full bg-gradient-celebratory flex items-center justify-center text-white text-xs font-bold">
              {(m.user.name ?? m.user.nickname).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink-900 truncate text-sm">
                {m.user.name ?? m.user.nickname}
                {!m.acceptedAt && <span className="ml-2 text-xs text-amber-700">⏳ ожидает</span>}
              </div>
              <div className="text-xs text-ink-900/50">{m.role.toLowerCase()}</div>
            </div>
            {m.inviteToken && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/o-invite/${m.inviteToken}`
                  navigator.clipboard.writeText(url)
                  toast.show('Ссылка скопирована', 'success')
                }}
                className="pill bg-amber-100 text-amber-900 text-xs"
              >
                Скопировать ссылку
              </button>
            )}
          </li>
        ))}
      </ul>
      {canInvite && (
        <button onClick={invite} className="w-full pill bg-ink-900 text-white text-sm py-2.5">
          + Создать ссылку-приглашение
        </button>
      )}
    </div>
  )
}

function BrandTab({ org, onUpdated }: { org: OrgSummary; onUpdated: () => void }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-6 text-sm text-ink-900/60 text-center">
      🎨 Редактор бренда — в следующей сессии. Сейчас можно через API:
      <br />
      <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
        PATCH /api/v1/organizations/{org.id}
      </code>
    </div>
  )
}

function BillingTab({ org }: { org: OrgSummary }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-6 text-sm text-ink-900/60 text-center">
      💳 План: <strong>{org.plan}</strong>
      <br />
      Платная подписка через TG Stars — в следующей сессии.
    </div>
  )
}
