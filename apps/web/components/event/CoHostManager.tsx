'use client'

import { useCallback, useEffect, useState } from 'react'
import { coHostsApi, type CoHostListItem } from '@/lib/api-client'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'

interface Props { eventId: string; editToken?: string }

export function CoHostManager({ eventId, editToken }: Props) {
  const toast = useToast()
  const [list, setList] = useState<CoHostListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await coHostsApi.list(eventId, editToken)
      setList(data.coHosts)
    } catch {
      // skip
    } finally {
      setLoading(false)
    }
  }, [eventId, editToken])

  useEffect(() => { load() }, [load])

  async function createInvite() {
    setBusy(true)
    try {
      const { invite } = await coHostsApi.invite(eventId, editToken)
      await navigator.clipboard.writeText(invite.url)
      toast.show('Ссылка-приглашение скопирована', 'success')
      load()
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не получилось', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(coHostId: string) {
    if (!confirm('Убрать co-host?')) return
    try {
      await coHostsApi.revoke(eventId, coHostId, editToken)
      toast.show('Доступ отозван', 'info')
      load()
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Не получилось', 'error')
    }
  }

  const pending = list.filter((c) => c.status === 'PENDING')
  const active = list.filter((c) => c.status === 'ACTIVE')

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="h-12 skeleton rounded-2xl" />
      ) : list.length === 0 ? (
        <p className="text-sm text-ink-900/60">
          Co-host может править ивент вместе с тобой. Пригласи друга по ссылке.
        </p>
      ) : (
        <ul className="space-y-2">
          {active.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 p-3">
              <Avatar
                name={c.user?.name ?? c.user?.nickname ?? '?'}
                src={c.user?.avatarUrl}
                seed={c.user?.id ?? c.id}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink-900 truncate">
                  {c.user?.name ?? c.user?.nickname ?? 'Без имени'}
                </div>
                <div className="text-xs text-emerald-700">Co-host · может править</div>
              </div>
              <button
                onClick={() => revoke(c.id)}
                className="text-xs font-semibold text-ink-900/50 hover:text-rose-600 underline"
              >
                убрать
              </button>
            </li>
          ))}
          {pending.map((c) => {
            const inviteUrl = c.inviteToken
              ? `${typeof window !== 'undefined' ? window.location.origin : ''}/co-host/${c.inviteToken}`
              : ''
            return (
              <li key={c.id} className="rounded-2xl bg-amber-50/60 border border-amber-200/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    ⏳ Ожидает принятия
                  </span>
                  <button
                    onClick={() => revoke(c.id)}
                    className="text-xs font-semibold text-ink-900/50 hover:text-rose-600 underline"
                  >
                    отменить
                  </button>
                </div>
                {inviteUrl && (
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={inviteUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 px-3 py-2 rounded-xl border border-amber-200 bg-white text-xs font-mono min-w-0"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteUrl)
                        toast.show('Скопировано', 'success')
                      }}
                      className="rounded-xl bg-ink-900 text-white px-3 py-2 text-xs font-semibold"
                    >
                      Копировать
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <button
        onClick={createInvite}
        disabled={busy || pending.length > 0}
        className="pill-secondary text-sm w-full disabled:opacity-50"
      >
        {pending.length > 0
          ? 'Уже есть pending-приглашение'
          : busy
          ? 'Создаём…'
          : '+ Пригласить co-host'}
      </button>
    </div>
  )
}
