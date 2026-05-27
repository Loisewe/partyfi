const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

interface RequestOptions {
  editToken?: string
  method?: string
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Attach editToken if provided (for anonymous owner access)
  if (options.editToken) {
    headers['x-edit-token'] = options.editToken
  }

  // Attach JWT if available in localStorage (for authenticated users)
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('wishly_access_token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(error.error ?? `HTTP ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}

// ── Events API ──────────────────────────────────────────────────────────────

import type {
  PublicEvent,
  OwnerEvent,
  PublicGuest,
  PublicEventResponse,
  CreateEventInput,
  UpdateEventInput,
  CancelEventInput,
  CreateRsvpInput,
  RsvpStatus,
} from '@wishly/shared'

interface EventHeaders {
  pin?: string
  editToken?: string
}

function buildEventHeaders(opts?: EventHeaders): Record<string, string> {
  const h: Record<string, string> = {}
  if (opts?.pin)       h['x-event-pin'] = opts.pin
  if (opts?.editToken) h['x-edit-token'] = opts.editToken
  return h
}

async function requestWithHeaders<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
  extraHeaders: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('wishly_access_token')
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(error.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const eventsApi = {
  async create(input: CreateEventInput): Promise<{ event: OwnerEvent; editToken?: string }> {
    return api.post('/events', input)
  },

  async get(tokenOrSlug: string, opts?: EventHeaders): Promise<PublicEventResponse> {
    return requestWithHeaders(`/events/${tokenOrSlug}`, 'GET', undefined, buildEventHeaders(opts))
  },

  async verifyPin(tokenOrSlug: string, pin: string): Promise<{ valid: boolean }> {
    return api.post(`/events/${tokenOrSlug}/verify-pin`, { pin })
  },

  async update(id: string, input: UpdateEventInput, opts?: EventHeaders): Promise<OwnerEvent> {
    return requestWithHeaders(`/events/${id}`, 'PATCH', input, buildEventHeaders(opts))
  },

  async cancel(id: string, input: CancelEventInput, opts?: EventHeaders): Promise<OwnerEvent> {
    return requestWithHeaders(`/events/${id}`, 'DELETE', input, buildEventHeaders(opts))
  },

  async rsvp(
    tokenOrSlug: string,
    input: CreateRsvpInput,
    opts?: EventHeaders,
  ): Promise<{ rsvp: { status: RsvpStatus; plusOnes: number; message: string | null; cancelToken?: string } }> {
    return requestWithHeaders(`/events/${tokenOrSlug}/rsvp`, 'POST', input, buildEventHeaders(opts))
  },

  async cancelRsvp(tokenOrSlug: string, cancelToken?: string): Promise<void> {
    const headers: Record<string, string> = {}
    if (cancelToken) headers['x-cancel-token'] = cancelToken
    await requestWithHeaders(`/events/${tokenOrSlug}/rsvp`, 'DELETE', undefined, headers)
  },

  async guests(tokenOrSlug: string, opts?: EventHeaders): Promise<{ guests: PublicGuest[] }> {
    return requestWithHeaders(`/events/${tokenOrSlug}/guests`, 'GET', undefined, buildEventHeaders(opts))
  },

  async mine(): Promise<{ events: PublicEvent[] }> {
    return api.get('/events/mine')
  },

  async duplicate(
    id: string,
    input: { startsAt?: string; title?: string },
    opts?: EventHeaders,
  ): Promise<{ event: OwnerEvent; editToken?: string }> {
    return requestWithHeaders(`/events/${id}/duplicate`, 'POST', input, buildEventHeaders(opts))
  },

  icalUrl(tokenOrSlug: string): string {
    return `${API_BASE}/events/${tokenOrSlug}/ical`
  },
}

// ── Payments API ────────────────────────────────────────────────────────────

export const paymentsApi = {
  async upgradeEvent(eventId: string): Promise<{ invoiceUrl: string; starsAmount: number }> {
    return api.post(`/events/${eventId}/upgrade`, {})
  },
}

// ── Co-host API ─────────────────────────────────────────────────────────────

export interface CoHostListItem {
  id: string
  status: 'PENDING' | 'ACTIVE' | 'REVOKED'
  addedAt: string
  user: { id: string; name: string | null; nickname: string; avatarUrl: string | null } | null
  inviteToken: string | null
}

export interface CoHostInvitePreview {
  eventTitle: string
  eventStartsAt: string
  hostName: string
  coverPresetSlug: string | null
}

export const coHostsApi = {
  async invite(eventId: string, editToken?: string): Promise<{ invite: { id: string; token: string; url: string } }> {
    return requestWithHeaders(`/events/${eventId}/co-hosts`, 'POST', {}, buildEventHeaders({ editToken }))
  },
  async list(eventId: string, editToken?: string): Promise<{ coHosts: CoHostListItem[] }> {
    return requestWithHeaders(`/events/${eventId}/co-hosts`, 'GET', undefined, buildEventHeaders({ editToken }))
  },
  async revoke(eventId: string, coHostId: string, editToken?: string): Promise<void> {
    await requestWithHeaders(`/events/${eventId}/co-hosts/${coHostId}`, 'DELETE', undefined, buildEventHeaders({ editToken }))
  },
  async getInvite(token: string): Promise<{ preview: CoHostInvitePreview }> {
    return api.get(`/co-host-invites/${token}`)
  },
  async acceptInvite(token: string): Promise<{ coHost: { id: string; eventId: string; eventTitle: string; status: string } }> {
    return api.post(`/co-host-invites/${token}/accept`, {})
  },
}

// ── Analytics API ───────────────────────────────────────────────────────────

export interface EventAnalytics {
  isPremium: boolean
  isLimitedByFreeTier: boolean
  summary: {
    totalViews: number
    uniqueViewers: number
    totalRsvps: number
    goingRsvps: number
    plusOnesTotal: number
    photoCount: number
    conversionViewToRsvp: number
  }
  viewsByDay: Array<{ day: string; count: number }>
  rsvpsByDay: Array<{ day: string; going: number; maybe: number; notGoing: number }>
  pollBreakdown: Array<{ option: string; count: number }>
}

export const analyticsApi = {
  async forEvent(eventId: string, editToken?: string): Promise<EventAnalytics> {
    return requestWithHeaders(`/events/${eventId}/analytics`, 'GET', undefined, buildEventHeaders({ editToken }))
  },
}

// ── Wishlists API (subset used for event attachment) ────────────────────────

export interface OwnedWishlistSummary {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  isPublic: boolean
  shareToken: string
  editToken: string
  itemCount: number
  updatedAt: string
  createdAt: string
}

export const wishlistsApi = {
  async mine(): Promise<OwnedWishlistSummary[]> {
    return api.get('/wishlists')
  },
}
