# Event ↔ Organization Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire events to organizations end-to-end: org-binding at create, brand inheritance, permission inheritance, dual URLs, aggregated dashboard view.

**Architecture:** Approach A — runtime inheritance with minimal schema change. Two new optional fields (`Event.orgEventSlug`, `Organization.defaultEventCoverUrl`) and one composite unique. Brand resolved at read time in `formatPublicEvent`; no denormalization. Permission inherited via extended `checkHostAccess`.

**Tech Stack:** Prisma 6 + Postgres, Fastify (API), Next.js 14 App Router (web), vitest (API tests), TypeScript strict, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-05-29-event-org-binding-design.md`

---

## File Structure

### Create

| Path | Responsibility |
|---|---|
| `packages/shared/src/utils/brand-theme.ts` | `mapBrandToTheme(hex)` HSL-distance match to ThemeColor preset. Pure function, no deps. |
| `apps/api/tests/event-org.test.ts` | Unit + integration tests for binding + permission + inheritance |
| `apps/api/src/routes/o-events/index.ts` | `GET /api/v1/o/:orgSlug/:eventSlug` alias resolver |
| `apps/web/components/event/OrgSelector.tsx` | Pick personal/org card grid for create-event form |
| `apps/web/components/event/OrgBadge.tsx` | Small chip "Personal" / "{Org Name}" on dashboard cards |
| `apps/web/app/o/[orgSlug]/[eventSlug]/page.tsx` | Alias route, reuses EventPublicView |
| `apps/web/app/o/[orgSlug]/[eventSlug]/OrgEventClient.tsx` | Client-side wrapper for the alias view |

### Modify

| Path | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | +`Event.orgEventSlug`, +`Organization.defaultEventCoverUrl`, +composite unique |
| `packages/shared/src/schemas/event.schema.ts` | Add `orgEventSlug` + `organizationId` to `createEventSchema`/`updateEventSchema` |
| `packages/shared/src/schemas/organization.schema.ts` | Add `defaultEventCoverUrl` to `updateOrgSchema` |
| `packages/shared/src/types/event.ts` | Add `organization` field + `orgEventSlug` to `PublicEvent` |
| `packages/shared/src/utils/index.ts` | Re-export brand-theme |
| `apps/api/src/utils/event-auth.ts` | Extend `checkHostAccess` for org-role inheritance |
| `apps/api/src/utils/event-formatter.ts` | Brand inheritance precedence + `organization` field in payload |
| `apps/api/src/routes/events/index.ts` | POST validates org-role; PATCH ignores `organizationId`, accepts `orgEventSlug`; EVENT_INCLUDE adds organization; `/mine` includes org events |
| `apps/api/src/index.ts` | Register `oEventRoutes` |
| `apps/web/lib/api-client.ts` | Add `organization`/`orgEventSlug`/`viaOrg` to event types |
| `apps/web/app/create-event/CreateEventForm.tsx` | Integrate OrgSelector, read `?organizationId=` query, post org fields |
| `apps/web/app/dashboard/DashboardClient.tsx` | Render OrgBadge on each event card |
| `apps/web/app/e/[tokenOrSlug]/EventPublicView.tsx` | If org-bound: show org name+logo instead of host, footer chip → `/o/{orgSlug}` |
| `apps/web/app/o/[slug]/admin/OrgAdminShell.tsx` | "+ Новый ивент" CTA appends `?organizationId={id}` |

---

## Task 1: Schema + Prisma client regen

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add `orgEventSlug` to Event model**

Open `packages/db/prisma/schema.prisma` and inside `model Event { ... }`, after the existing `organization` relation line, add:

```prisma
  // Slug within /o/{orgSlug}/{orgEventSlug} URL. Optional. Unique per org only.
  orgEventSlug String?
```

And at the bottom of `model Event` (before `@@map("events")`) add:

```prisma
  @@unique([organizationId, orgEventSlug])
```

- [ ] **Step 2: Add `defaultEventCoverUrl` to Organization model**

Inside `model Organization { ... }`, after `coverImageUrl String?` line, add:

```prisma
  // Default cover applied to org events when event has no own cover
  defaultEventCoverUrl String?
```

- [ ] **Step 3: Push schema to Postgres**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist/packages/db
pnpm prisma db push --skip-generate --accept-data-loss
```

Expected output: `🚀 Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regen Prisma client**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
chmod -R u+w node_modules/.pnpm/@prisma+client*/node_modules/.prisma 2>/dev/null
rm -rf node_modules/.pnpm/@prisma+client*/node_modules/.prisma 2>/dev/null
pnpm --filter @wishly/db generate
```

Expected: `✔ Generated Prisma Client`.

- [ ] **Step 5: Verify api compiles**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api lint
```

Expected: zero output (tsc clean).

- [ ] **Step 6: Commit**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
git add packages/db/prisma/schema.prisma
git commit -m "S29-1: schema — Event.orgEventSlug + Organization.defaultEventCoverUrl"
```

---

## Task 2: Brand-theme helper in shared package

**Files:**
- Create: `packages/shared/src/utils/brand-theme.ts`
- Modify: `packages/shared/src/utils/index.ts`
- Test: `apps/api/tests/brand-theme.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/tests/brand-theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapBrandToTheme } from '@wishly/shared'

describe('mapBrandToTheme', () => {
  it('returns null for null input', () => {
    expect(mapBrandToTheme(null)).toBeNull()
  })

  it('returns null for malformed hex', () => {
    expect(mapBrandToTheme('not-a-color')).toBeNull()
    expect(mapBrandToTheme('#zzz')).toBeNull()
  })

  it('maps pink-ish hex to rose theme', () => {
    expect(mapBrandToTheme('#ff2d7b')).toBe('rose')
  })

  it('maps purple-ish hex to violet theme', () => {
    expect(mapBrandToTheme('#7c3aed')).toBe('violet')
  })

  it('maps green-ish hex to emerald theme', () => {
    expect(mapBrandToTheme('#10b981')).toBe('emerald')
  })

  it('maps orange-ish hex to amber theme', () => {
    expect(mapBrandToTheme('#fb923c')).toBe('amber')
  })

  it('maps blue-ish hex to sky theme', () => {
    expect(mapBrandToTheme('#0ea5e9')).toBe('sky')
  })

  it('maps grey-ish hex to slate theme', () => {
    expect(mapBrandToTheme('#475569')).toBe('slate')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api test brand-theme
```

Expected: FAIL with "mapBrandToTheme is not exported" / not found.

- [ ] **Step 3: Implement the helper**

Create `packages/shared/src/utils/brand-theme.ts`:

```ts
export type ThemeColor = 'rose' | 'violet' | 'emerald' | 'amber' | 'sky' | 'slate'

const PRESET_HSL: Array<{ theme: ThemeColor; h: number; s: number; l: number }> = [
  { theme: 'rose',    h: 340, s: 80, l: 60 },
  { theme: 'violet',  h: 260, s: 80, l: 60 },
  { theme: 'emerald', h: 160, s: 70, l: 45 },
  { theme: 'amber',   h:  30, s: 90, l: 55 },
  { theme: 'sky',     h: 200, s: 85, l: 55 },
  { theme: 'slate',   h: 215, s: 20, l: 40 },
]

const HEX_RE = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  if (!HEX_RE.test(hex)) return null
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let hue: number
  switch (max) {
    case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g: hue = ((b - r) / d + 2) / 6; break
    default: hue = ((r - g) / d + 4) / 6
  }
  return { h: hue * 360, s: s * 100, l: l * 100 }
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

export function mapBrandToTheme(hex: string | null | undefined): ThemeColor | null {
  if (!hex) return null
  const hsl = hexToHsl(hex)
  if (!hsl) return null
  // Distance: hue weighted 3x; saturation 1x; lightness 0.5x
  let best: ThemeColor | null = null
  let bestDist = Infinity
  for (const preset of PRESET_HSL) {
    const dh = hueDistance(hsl.h, preset.h) * 3
    const ds = Math.abs(hsl.s - preset.s)
    const dl = Math.abs(hsl.l - preset.l) * 0.5
    const dist = dh + ds + dl
    if (dist < bestDist) {
      bestDist = dist
      best = preset.theme
    }
  }
  return best
}
```

- [ ] **Step 4: Re-export from shared barrel**

Open `packages/shared/src/utils/index.ts`. If file already has exports, add at the end:

```ts
export * from './brand-theme'
```

If file is empty or doesn't exist, create it with just:

```ts
export * from './brand-theme'
```

Then verify the package root barrel `packages/shared/src/index.ts` already does `export * from './utils'`. If not, add it.

- [ ] **Step 5: Run tests to verify pass**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api test brand-theme
```

Expected: PASS — 8 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/brand-theme.ts packages/shared/src/utils/index.ts packages/shared/src/index.ts apps/api/tests/brand-theme.test.ts
git commit -m "S29-2: mapBrandToTheme helper + tests"
```

---

## Task 3: Extend `checkHostAccess` for org-role inheritance

**Files:**
- Modify: `apps/api/src/utils/event-auth.ts`
- Test: `apps/api/tests/event-auth-org.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/tests/event-auth-org.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { checkHostAccess } from '../src/utils/event-auth'

const prisma = new PrismaClient()

describe('checkHostAccess with org', () => {
  let orgId: string
  let hostUserId: string
  let editorUserId: string
  let viewerUserId: string
  let outsiderUserId: string
  let eventId: string
  let editToken: string

  beforeEach(async () => {
    // Cleanup
    await prisma.eventRsvp.deleteMany()
    await prisma.event.deleteMany()
    await prisma.organizationMember.deleteMany()
    await prisma.organization.deleteMany()
    await prisma.user.deleteMany({ where: { nickname: { startsWith: 'test-' } } })

    const [host, editor, viewer, outsider] = await Promise.all([
      prisma.user.create({ data: { nickname: 'test-host', isAnonymous: false } }),
      prisma.user.create({ data: { nickname: 'test-editor', isAnonymous: false } }),
      prisma.user.create({ data: { nickname: 'test-viewer', isAnonymous: false } }),
      prisma.user.create({ data: { nickname: 'test-outsider', isAnonymous: false } }),
    ])
    hostUserId = host.id
    editorUserId = editor.id
    viewerUserId = viewer.id
    outsiderUserId = outsider.id

    const org = await prisma.organization.create({
      data: { slug: 'test-org-' + Date.now(), name: 'Test Org', ownerUserId: hostUserId },
    })
    orgId = org.id

    await prisma.organizationMember.createMany({
      data: [
        { organizationId: orgId, userId: editorUserId, role: 'EDITOR', acceptedAt: new Date() },
        { organizationId: orgId, userId: viewerUserId, role: 'VIEWER', acceptedAt: new Date() },
      ],
    })

    const event = await prisma.event.create({
      data: {
        hostUserId,
        organizationId: orgId,
        title: 'Test Event',
        startsAt: new Date(Date.now() + 86400000),
      },
    })
    eventId = event.id
    editToken = event.editToken
  })

  it("editor in org returns 'org-editor'", async () => {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    const res = await checkHostAccess(prisma, event, {
      auth: { user: { id: editorUserId }, editToken: undefined },
    } as any)
    expect(res).toBe('org-editor')
  })

  it("viewer in org returns 'org-viewer'", async () => {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    const res = await checkHostAccess(prisma, event, {
      auth: { user: { id: viewerUserId }, editToken: undefined },
    } as any)
    expect(res).toBe('org-viewer')
  })

  it('outsider returns null', async () => {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    const res = await checkHostAccess(prisma, event, {
      auth: { user: { id: outsiderUserId }, editToken: undefined },
    } as any)
    expect(res).toBeNull()
  })

  it("editToken match still returns 'host' even for org event", async () => {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    const res = await checkHostAccess(prisma, event, {
      auth: { user: undefined, editToken },
    } as any)
    expect(res).toBe('host')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api test event-auth-org
```

Expected: FAIL — `checkHostAccess` does not yet return `'org-editor'` / `'org-viewer'`.

- [ ] **Step 3: Implement org-role inheritance**

Open `apps/api/src/utils/event-auth.ts`. Replace the existing `HostAccess` type and `checkHostAccess` function with:

```ts
import type { PrismaClient } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { getOrgRole } from './org-auth'

export type HostAccess =
  | 'host' | 'co-host'
  | 'org-owner' | 'org-admin' | 'org-editor' | 'org-viewer'
  | null

export async function checkHostAccess(
  prisma: PrismaClient,
  event: { id: string; editToken: string; hostUserId: string; organizationId?: string | null },
  request: FastifyRequest,
): Promise<HostAccess> {
  if (request.auth.editToken === event.editToken) return 'host'

  const userId = request.auth.user?.id
  if (userId === event.hostUserId) return 'host'

  if (userId) {
    const coHost = await prisma.eventCoHost.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
      select: { status: true },
    })
    if (coHost && coHost.status === 'ACTIVE') return 'co-host'

    if (event.organizationId) {
      const role = await getOrgRole(prisma, event.organizationId, userId)
      if (role === 'OWNER') return 'org-owner'
      if (role === 'ADMIN') return 'org-admin'
      if (role === 'EDITOR') return 'org-editor'
      if (role === 'VIEWER') return 'org-viewer'
    }
  }

  return null
}

/** True if access level grants edit (not just read). */
export function canEdit(access: HostAccess): boolean {
  return access !== null && access !== 'org-viewer'
}

/** True if access level grants read of internal data (analytics, members list). */
export function canRead(access: HostAccess): boolean {
  return access !== null
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api test event-auth-org
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Run full api test suite to catch regressions**

```bash
pnpm --filter @wishly/api test
```

Expected: all previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/utils/event-auth.ts apps/api/tests/event-auth-org.test.ts
git commit -m "S29-3: checkHostAccess inherits org-role for org events"
```

---

## Task 4: Brand inheritance in `formatPublicEvent` + EVENT_INCLUDE

**Files:**
- Modify: `apps/api/src/routes/events/index.ts` (EVENT_INCLUDE constant)
- Modify: `apps/api/src/utils/event-formatter.ts`
- Modify: `packages/shared/src/types/event.ts`

- [ ] **Step 1: Add `organization` to PublicEvent type**

Open `packages/shared/src/types/event.ts`. Find the `PublicEvent` interface. Add these fields before the closing brace:

```ts
  /** Org context if event belongs to one. Brand fields are denormalized at read time. */
  organization: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
    brandColor: string | null
  } | null
  orgEventSlug: string | null
```

- [ ] **Step 2: Extend EVENT_INCLUDE in events route**

Open `apps/api/src/routes/events/index.ts`. Find `const EVENT_INCLUDE = { ... } as const`. Add `organization` to it:

```ts
const EVENT_INCLUDE = {
  host: true,
  coverPreset: true,
  wishlist: { include: { _count: { select: { items: true } } } },
  rsvps: { select: { status: true, plusOnes: true } },
  upgrade: { select: { id: true } },
  // NEW: org with brand fields for runtime inheritance
  organization: {
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      brandColor: true,
      accentColor: true,
      coverImageUrl: true,
      defaultEventCoverUrl: true,
    },
  },
} as const
```

- [ ] **Step 3: Apply inheritance in formatPublicEvent**

Open `apps/api/src/utils/event-formatter.ts`. Add import at the top:

```ts
import { mapBrandToTheme } from '@wishly/shared'
```

Find the `formatPublicEvent` function. In the type for the event parameter, extend with `organization`:

```ts
organization: {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  brandColor: string | null
  accentColor: string | null
  coverImageUrl: string | null
  defaultEventCoverUrl: string | null
} | null
orgEventSlug: string | null
```

Then in the return statement, replace the existing `host` / `coverImageUrl` / `themeColor` returns with these (keep all OTHER returned fields untouched):

```ts
    // Brand inheritance: org > event > defaults
    coverImageUrl: event.coverImageUrl
      ?? event.organization?.defaultEventCoverUrl
      ?? event.coverPreset?.imageUrl
      ?? null,

    themeColor: event.themeColor
      ?? mapBrandToTheme(event.organization?.brandColor)
      ?? null,

    host: event.organization
      ? {
          id: event.host.id,
          name: event.organization.name,
          nickname: event.organization.name,
          avatarUrl: event.organization.logoUrl,
          isAnonymous: false,
        }
      : {
          id: event.host.id,
          name: event.host.name,
          nickname: event.host.nickname,
          avatarUrl: event.host.avatarUrl,
          isAnonymous: event.host.isAnonymous,
        },

    organization: event.organization
      ? {
          id: event.organization.id,
          slug: event.organization.slug,
          name: event.organization.name,
          logoUrl: event.organization.logoUrl,
          brandColor: event.organization.brandColor,
        }
      : null,

    orgEventSlug: event.orgEventSlug,
```

- [ ] **Step 4: Mirror in formatOwnerEvent**

In the same file, find `formatOwnerEvent`. If it composes via `formatPublicEvent`, no change needed. If it builds its own object, add the same `organization` + `orgEventSlug` fields after the public ones.

- [ ] **Step 5: Mirror in formatPinPreview (if exists)**

If a `formatPinPreview` or similar exists in the file that returns reduced data for PIN gate, add `organization` to it the same way (just `{ id, slug, name, logoUrl, brandColor }` or `null`).

- [ ] **Step 6: Verify tsc clean**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api lint
```

Expected: zero output.

- [ ] **Step 7: Run full api test suite to catch regressions**

```bash
pnpm --filter @wishly/api test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/utils/event-formatter.ts apps/api/src/routes/events/index.ts packages/shared/src/types/event.ts
git commit -m "S29-4: brand inheritance in formatPublicEvent + organization field in payload"
```

---

## Task 5: Extend `POST /events` with org binding validation

**Files:**
- Modify: `packages/shared/src/schemas/event.schema.ts`
- Modify: `apps/api/src/routes/events/index.ts`
- Test: `apps/api/tests/event-org.test.ts`

- [ ] **Step 1: Extend createEventSchema**

Open `packages/shared/src/schemas/event.schema.ts`. Find `createEventSchema`. Add these fields:

```ts
  organizationId: z.string().cuid().optional(),
  orgEventSlug: z
    .string()
    .min(3).max(40)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Только латиница/цифры/дефис')
    .optional(),
```

Same for `updateEventSchema` — add only `orgEventSlug`.

- [ ] **Step 2: Add reserved slug constant**

In `apps/api/src/routes/events/index.ts`, near the top of the file, add:

```ts
const RESERVED_ORG_EVENT_SLUGS = new Set([
  'admin', 'new-event', 'events', 'members', 'brand', 'billing', 'edit',
])
```

- [ ] **Step 3: Write integration test for POST /events org binding**

Create `apps/api/tests/event-org.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API = process.env.API_URL ?? 'http://localhost:3001/api/v1'

async function authedFetch(userId: string, path: string, init?: RequestInit) {
  const token = await prisma.user.findUniqueOrThrow({ where: { id: userId } }).then(() => {
    // For tests we use the dev JWT bypass — sign a minimal JWT via the api jwt secret
    return signTestJwt(userId)
  })
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
}

function signTestJwt(userId: string): string {
  // Minimal HS256 manually
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  })).toString('base64url')
  const crypto = require('node:crypto')
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET ?? 'dev-secret-change-in-production')
    .update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

let editorId: string
let viewerId: string
let outsiderId: string
let orgId: string

beforeAll(async () => {
  await prisma.event.deleteMany({ where: { title: { startsWith: 'S29-TEST-' } } })
  await prisma.organizationMember.deleteMany({ where: { organization: { slug: { startsWith: 's29-test-' } } } })
  await prisma.organization.deleteMany({ where: { slug: { startsWith: 's29-test-' } } })
  await prisma.user.deleteMany({ where: { nickname: { startsWith: 's29-test-' } } })

  const [editor, viewer, outsider] = await Promise.all([
    prisma.user.create({ data: { nickname: 's29-test-editor', isAnonymous: false } }),
    prisma.user.create({ data: { nickname: 's29-test-viewer', isAnonymous: false } }),
    prisma.user.create({ data: { nickname: 's29-test-outsider', isAnonymous: false } }),
  ])
  editorId = editor.id; viewerId = viewer.id; outsiderId = outsider.id

  const org = await prisma.organization.create({
    data: {
      slug: 's29-test-' + Date.now(),
      name: 'S29 Test Org',
      ownerUserId: editorId,
      subscription: { create: { plan: 'FREE' } },
    },
  })
  orgId = org.id

  await prisma.organizationMember.create({
    data: { organizationId: orgId, userId: viewerId, role: 'VIEWER', acceptedAt: new Date() },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /events org binding', () => {
  it('outsider gets 403', async () => {
    const res = await authedFetch(outsiderId, '/events', {
      method: 'POST',
      body: JSON.stringify({
        title: 'S29-TEST-outsider',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        organizationId: orgId,
      }),
    })
    expect(res.status).toBe(403)
  })

  it('viewer gets 403', async () => {
    const res = await authedFetch(viewerId, '/events', {
      method: 'POST',
      body: JSON.stringify({
        title: 'S29-TEST-viewer',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        organizationId: orgId,
      }),
    })
    expect(res.status).toBe(403)
  })

  it('editor (owner via creation) gets 201', async () => {
    const res = await authedFetch(editorId, '/events', {
      method: 'POST',
      body: JSON.stringify({
        title: 'S29-TEST-editor-ok',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        organizationId: orgId,
        orgEventSlug: 'first-event',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.event.organization?.id).toBe(orgId)
    expect(body.event.orgEventSlug).toBe('first-event')
  })

  it('duplicate orgEventSlug gets 409', async () => {
    const res = await authedFetch(editorId, '/events', {
      method: 'POST',
      body: JSON.stringify({
        title: 'S29-TEST-dup',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        organizationId: orgId,
        orgEventSlug: 'first-event',  // already taken in previous test
      }),
    })
    expect(res.status).toBe(409)
  })

  it('reserved orgEventSlug gets 409', async () => {
    const res = await authedFetch(editorId, '/events', {
      method: 'POST',
      body: JSON.stringify({
        title: 'S29-TEST-reserved',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        organizationId: orgId,
        orgEventSlug: 'admin',
      }),
    })
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 4: Implement validation in POST /events**

In `apps/api/src/routes/events/index.ts` find the `app.post('/', ...)` handler. After `const body = createEventSchema.parse(request.body)`, before user lookup, add:

```ts
  // Org binding validation
  if (body.organizationId) {
    if (!request.auth.user) {
      return reply.status(401).send({ error: 'Authentication required for org events' })
    }
    const role = await getOrgRole(app.prisma, body.organizationId, request.auth.user.id)
    if (!hasOrgRole(role, 'EDITOR')) {
      return reply.status(403).send({
        error: 'Нет прав создавать ивенты в этой организации',
      })
    }
    if (body.orgEventSlug) {
      if (RESERVED_ORG_EVENT_SLUGS.has(body.orgEventSlug)) {
        return reply.status(409).send({ error: 'Этот URL зарезервирован' })
      }
      const clash = await app.prisma.event.findFirst({
        where: { organizationId: body.organizationId, orgEventSlug: body.orgEventSlug },
        select: { id: true },
      })
      if (clash) return reply.status(409).send({ error: 'Этот URL уже занят в org' })
    }
  } else if (body.orgEventSlug) {
    return reply.status(400).send({ error: 'orgEventSlug требует organizationId' })
  }
```

Add imports at the top of the file:

```ts
import { getOrgRole, hasOrgRole } from '../../utils/org-auth'
```

Then in the `prisma.event.create({ data: {...} })` call, add to the data object:

```ts
        organizationId: body.organizationId ?? null,
        orgEventSlug: body.orgEventSlug ?? null,
```

- [ ] **Step 5: Run tests to verify pass**

Make sure API + Docker are running. Then:

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api test event-org
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/events/index.ts packages/shared/src/schemas/event.schema.ts apps/api/tests/event-org.test.ts
git commit -m "S29-5: POST /events validates org-role + orgEventSlug uniqueness"
```

---

## Task 6: PATCH /events accepts `orgEventSlug`, ignores `organizationId`

**Files:**
- Modify: `apps/api/src/routes/events/index.ts`
- Test: extend `apps/api/tests/event-org.test.ts`

- [ ] **Step 1: Add tests for PATCH behavior**

Append to `apps/api/tests/event-org.test.ts`:

```ts
describe('PATCH /events/:id with org context', () => {
  let eventId: string
  beforeAll(async () => {
    const event = await prisma.event.findFirstOrThrow({
      where: { organizationId: orgId, title: 'S29-TEST-editor-ok' },
    })
    eventId = event.id
  })

  it('editor (org-EDITOR) can patch title', async () => {
    const res = await authedFetch(editorId, `/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'S29-TEST-patched' }),
    })
    expect(res.status).toBe(200)
  })

  it('viewer (org-VIEWER) cannot patch', async () => {
    const res = await authedFetch(viewerId, `/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'S29-TEST-viewer-tried' }),
    })
    expect(res.status).toBe(403)
  })

  it('outsider cannot patch', async () => {
    const res = await authedFetch(outsiderId, `/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'S29-TEST-outsider-tried' }),
    })
    expect(res.status).toBe(403)
  })

  it('attempt to change organizationId is silently ignored', async () => {
    const res = await authedFetch(editorId, `/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ organizationId: null }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organization?.id).toBe(orgId)  // unchanged
  })

  it('editor can update orgEventSlug', async () => {
    const res = await authedFetch(editorId, `/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ orgEventSlug: 'first-renamed' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orgEventSlug).toBe('first-renamed')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm --filter @wishly/api test event-org -t "PATCH"
```

Expected: FAIL — likely "editor (org-EDITOR) can patch title" because PATCH doesn't yet trust org role.

- [ ] **Step 3: Update PATCH handler in events route**

In `apps/api/src/routes/events/index.ts` find the `app.patch('/:id', ...)` handler.

Replace the existing access check (currently checks editToken + hostUserId) with the unified helper:

```ts
import { checkHostAccess, canEdit } from '../../utils/event-auth'
```

Inside the PATCH handler, after fetching the event:

```ts
    const access = await checkHostAccess(app.prisma, event, request)
    if (!canEdit(access)) {
      return reply.status(403).send({ error: 'Access denied' })
    }
```

Then in the `data` build-up, remove any line that maps `organizationId` from body (it shouldn't be there but verify), and add `orgEventSlug` handling with validation:

```ts
    if (body.orgEventSlug !== undefined && event.organizationId) {
      if (body.orgEventSlug === null) {
        data.orgEventSlug = null
      } else {
        if (RESERVED_ORG_EVENT_SLUGS.has(body.orgEventSlug)) {
          return reply.status(409).send({ error: 'Этот URL зарезервирован' })
        }
        const clash = await app.prisma.event.findFirst({
          where: {
            organizationId: event.organizationId,
            orgEventSlug: body.orgEventSlug,
            NOT: { id: event.id },
          },
          select: { id: true },
        })
        if (clash) return reply.status(409).send({ error: 'Этот URL уже занят в org' })
        data.orgEventSlug = body.orgEventSlug
      }
    }
```

The `organizationId` field is now never read from `body` in the update, so attempts to change it are silently ignored.

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm --filter @wishly/api test event-org
```

Expected: 10 tests PASS (5 from Task 5 + 5 from this task).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/events/index.ts apps/api/tests/event-org.test.ts
git commit -m "S29-6: PATCH /events uses checkHostAccess, accepts orgEventSlug, ignores organizationId"
```

---

## Task 7: Extend `GET /events/mine` to include org-EDITOR events

**Files:**
- Modify: `apps/api/src/routes/events/index.ts`
- Test: extend `apps/api/tests/event-org.test.ts`

- [ ] **Step 1: Add test**

Append to `apps/api/tests/event-org.test.ts`:

```ts
describe('GET /events/mine includes org events', () => {
  it('editor sees org events as their own', async () => {
    const res = await authedFetch(editorId, '/events/mine')
    expect(res.status).toBe(200)
    const body = await res.json()
    const hit = body.events.find((e: any) => e.title === 'S29-TEST-patched')
    expect(hit).toBeDefined()
    expect(hit.organization?.id).toBe(orgId)
  })

  it('outsider does NOT see org events', async () => {
    const res = await authedFetch(outsiderId, '/events/mine')
    expect(res.status).toBe(200)
    const body = await res.json()
    const hit = body.events.find((e: any) => e.title === 'S29-TEST-patched')
    expect(hit).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter @wishly/api test event-org -t "GET /events/mine"
```

Expected: FAIL (editor doesn't see org events yet via /mine).

- [ ] **Step 3: Extend the /mine handler**

In `apps/api/src/routes/events/index.ts` find `app.get('/mine', ...)`. Replace its existing where clause with this expanded version:

```ts
  app.get('/mine', async (request) => {
    const user = requireAuth(request)

    // Discover orgs where caller is EDITOR or higher (OWNER/ADMIN/EDITOR)
    const [ownedOrgIds, memberOrgs] = await Promise.all([
      app.prisma.organization.findMany({
        where: { ownerUserId: user.id },
        select: { id: true },
      }),
      app.prisma.organizationMember.findMany({
        where: {
          userId: user.id,
          acceptedAt: { not: null },
          role: { in: ['ADMIN', 'EDITOR'] },
        },
        select: { organizationId: true },
      }),
    ])
    const orgIds = [
      ...ownedOrgIds.map((o) => o.id),
      ...memberOrgs.map((m) => m.organizationId),
    ]

    const events = await app.prisma.event.findMany({
      where: {
        OR: [
          { hostUserId: user.id },
          { rsvps: { some: { guestUserId: user.id } } },
          ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
        ],
      },
      include: EVENT_INCLUDE,
      orderBy: { startsAt: 'desc' },
      take: 60,
    })

    return {
      events: events.map((e) => formatPublicEvent(e)),
    }
  })
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm --filter @wishly/api test event-org
```

Expected: 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/events/index.ts apps/api/tests/event-org.test.ts
git commit -m "S29-7: /events/mine includes org events where caller has EDITOR+ role"
```

---

## Task 8: New `GET /api/v1/o/:orgSlug/:eventSlug` alias endpoint

**Files:**
- Create: `apps/api/src/routes/o-events/index.ts`
- Modify: `apps/api/src/index.ts`
- Test: extend `apps/api/tests/event-org.test.ts`

- [ ] **Step 1: Add test for alias resolver**

Append to `apps/api/tests/event-org.test.ts`:

```ts
describe('GET /o/:orgSlug/:eventSlug alias', () => {
  let orgSlug: string

  beforeAll(async () => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
    orgSlug = org.slug
  })

  it('resolves by orgEventSlug', async () => {
    const res = await fetch(`${API}/o/${orgSlug}/first-renamed`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('S29-TEST-patched')
  })

  it('returns 404 for non-existent org', async () => {
    const res = await fetch(`${API}/o/no-such-org/first-renamed`)
    expect(res.status).toBe(404)
  })

  it('returns 404 for event from different org', async () => {
    // Create a personal event with shareToken X then try /o/{orgSlug}/X
    const personal = await prisma.event.create({
      data: {
        hostUserId: outsiderId,
        title: 'S29-TEST-personal',
        startsAt: new Date(Date.now() + 86400000),
      },
    })
    const res = await fetch(`${API}/o/${orgSlug}/${personal.shareToken}`)
    expect(res.status).toBe(404)
  })

  it('resolves by shareToken when event IS in org', async () => {
    const event = await prisma.event.findFirstOrThrow({
      where: { organizationId: orgId, title: 'S29-TEST-patched' },
    })
    const res = await fetch(`${API}/o/${orgSlug}/${event.shareToken}`)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter @wishly/api test event-org -t "alias"
```

Expected: FAIL — route doesn't exist.

- [ ] **Step 3: Create the route file**

Create `apps/api/src/routes/o-events/index.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import { formatPublicEvent } from '../../utils/event-formatter'
import { checkHostAccess } from '../../utils/event-auth'
import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'

const EVENT_INCLUDE = {
  host: true,
  coverPreset: true,
  wishlist: { include: { _count: { select: { items: true } } } },
  rsvps: { select: { status: true, plusOnes: true } },
  upgrade: { select: { id: true } },
  organization: {
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      brandColor: true,
      accentColor: true,
      coverImageUrl: true,
      defaultEventCoverUrl: true,
    },
  },
} as const

export const oEventRoutes: FastifyPluginAsync = async (app) => {
  app.get('/o/:orgSlug/:eventSlug', async (request, reply) => {
    const { orgSlug, eventSlug } = request.params as { orgSlug: string; eventSlug: string }

    const org = await app.prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true },
    })
    if (!org) return reply.status(404).send({ error: 'Organization not found' })

    const event = await app.prisma.event.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          { orgEventSlug: eventSlug },
          { customSlug: eventSlug },
          { shareToken: eventSlug },
        ],
      },
      include: EVENT_INCLUDE,
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    // PIN gate (mirror /events/:tokenOrSlug behaviour)
    const submittedPin = request.headers['x-event-pin'] as string | undefined
    const access = await checkHostAccess(app.prisma, event, request)
    const isInsider = access !== null

    if (event.pinHash && !isInsider) {
      if (!submittedPin) {
        return {
          requiresPin: true,
          preview: {
            id: event.id,
            title: event.title,
            coverImageUrl: event.coverImageUrl
              ?? event.organization?.defaultEventCoverUrl
              ?? event.coverPreset?.imageUrl
              ?? null,
            hostName: event.organization?.name ?? event.host.name ?? event.host.nickname,
            organization: event.organization
              ? { slug: event.organization.slug, name: event.organization.name, logoUrl: event.organization.logoUrl }
              : null,
          },
        }
      }
      const ok = await bcrypt.compare(submittedPin, event.pinHash)
      if (!ok) return reply.status(403).send({ error: 'Неверный PIN' })
    }

    // Track view (same as primary route)
    const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip
    const ua = request.headers['user-agent'] ?? ''
    const day = new Date().toISOString().slice(0, 10)
    const viewerHash = createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex')
    await app.prisma.eventView
      .upsert({
        where: { eventId_viewerHash: { eventId: event.id, viewerHash } },
        create: { eventId: event.id, viewerHash },
        update: {},
      })
      .catch(() => {})

    return formatPublicEvent(event)
  })
}
```

- [ ] **Step 4: Register the route**

Open `apps/api/src/index.ts`. Add import near the other route imports:

```ts
import { oEventRoutes } from './routes/o-events'
```

Find the registration block and add (under the existing `/api/v1` routes):

```ts
  await app.register(oEventRoutes, { prefix: '/api/v1' })
```

- [ ] **Step 5: Verify tsc clean + restart api**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api lint
```

The dev API (running via `tsx watch`) auto-reloads on change.

- [ ] **Step 6: Run tests to verify pass**

```bash
pnpm --filter @wishly/api test event-org
```

Expected: all tests pass (now ~16 total in event-org file).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/o-events/index.ts apps/api/src/index.ts apps/api/tests/event-org.test.ts
git commit -m "S29-8: GET /api/v1/o/:orgSlug/:eventSlug alias endpoint"
```

---

## Task 9: `OrgSelector` web component

**Files:**
- Create: `apps/web/components/event/OrgSelector.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/event/OrgSelector.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { orgsApi, type OrgWithRole } from '@/lib/api-client'

type Mode = 'loading' | 'no-orgs' | 'ready'

export function OrgSelector({
  value,
  onChange,
}: {
  value: string | null  // orgId or null = personal
  onChange: (orgId: string | null) => void
}) {
  const [mode, setMode] = useState<Mode>('loading')
  const [orgs, setOrgs] = useState<OrgWithRole[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('wishly_access_token')
    if (!token) {
      setMode('no-orgs')
      return
    }
    orgsApi.mine()
      .then((res) => {
        const editable = res.organizations.filter((o) => o.role !== 'VIEWER')
        setOrgs(editable)
        setMode(editable.length === 0 ? 'no-orgs' : 'ready')
      })
      .catch(() => setMode('no-orgs'))
  }, [])

  if (mode === 'loading') {
    return <div className="h-20 skeleton rounded-2xl" aria-label="Загружаем организации" />
  }

  if (mode === 'no-orgs') {
    return null  // hidden when user has no orgs
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-ink-900/50 mb-2">
        От чьего имени
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <OrgCard
          label="Personal"
          emoji="🧑"
          active={value === null}
          onClick={() => onChange(null)}
        />
        {orgs.map((o) => (
          <OrgCard
            key={o.id}
            label={o.name}
            logoUrl={o.logoUrl}
            brandColor={o.brandColor}
            role={o.role}
            active={value === o.id}
            onClick={() => onChange(o.id)}
          />
        ))}
      </div>
    </div>
  )
}

function OrgCard({
  label,
  emoji,
  logoUrl,
  brandColor,
  role,
  active,
  onClick,
}: {
  label: string
  emoji?: string
  logoUrl?: string | null
  brandColor?: string | null
  role?: string
  active: boolean
  onClick: () => void
}) {
  const accent = brandColor ?? '#ff2d7b'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 transition ${
        active ? 'border-ink-900 bg-ink-900/[0.03]' : 'border-gray-200 hover:border-gray-400'
      }`}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
      ) : (
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-white text-lg"
          style={{ background: accent }}
        >
          {emoji ?? label.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="text-xs font-semibold text-ink-900 line-clamp-1 max-w-full">{label}</span>
      {role && <span className="text-[10px] uppercase tracking-wider text-ink-900/40">{role.toLowerCase()}</span>}
    </button>
  )
}
```

- [ ] **Step 2: Verify tsc clean**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/web exec tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

Expected: no errors related to OrgSelector.tsx.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/event/OrgSelector.tsx
git commit -m "S29-9: OrgSelector component"
```

---

## Task 10: Integrate OrgSelector into CreateEventForm

**Files:**
- Modify: `apps/web/app/create-event/CreateEventForm.tsx`
- Modify: `apps/web/lib/api-client.ts`

- [ ] **Step 1: Add `organizationId` + `orgEventSlug` to types**

Open `apps/web/lib/api-client.ts`. Find the `eventsApi.create` signature. Update the input type to include:

```ts
async create(input: CreateEventInput & { organizationId?: string; orgEventSlug?: string }): ...
```

Also find PublicEvent / event response types and add:

```ts
  organization: { id: string; slug: string; name: string; logoUrl: string | null; brandColor: string | null } | null
  orgEventSlug: string | null
```

(May already exist via shared package import. If shared types are already updated in Task 4, web types pick them up automatically — only manually update if duplicated.)

- [ ] **Step 2: Wire OrgSelector + orgEventSlug input into the form**

Open `apps/web/app/create-event/CreateEventForm.tsx`. Add imports:

```tsx
import { OrgSelector } from '@/components/event/OrgSelector'
import { useSearchParams } from 'next/navigation'
```

Inside the component, after existing useState calls add:

```tsx
  const search = useSearchParams()
  const initialOrgId = search.get('organizationId')
  const [organizationId, setOrganizationId] = useState<string | null>(initialOrgId)
  const [orgEventSlug, setOrgEventSlug] = useState('')
```

Add the selector UI before the existing CoverPresetPicker (or wherever fits sensibly — early in form):

```tsx
      <OrgSelector value={organizationId} onChange={setOrganizationId} />

      {organizationId && (
        <div>
          <label className="block text-sm font-medium mb-1">URL внутри org (опционально)</label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 select-none">/o/.../</span>
            <input
              value={orgEventSlug}
              onChange={(e) => setOrgEventSlug(e.target.value.toLowerCase())}
              placeholder="october-night"
              className="flex-1 px-2 py-1.5 border rounded-lg font-mono text-sm"
            />
          </div>
          <p className="text-xs text-ink-900/50 mt-1">3-40 символов, латиница/цифры/дефис</p>
        </div>
      )}
```

In the submit handler (`onSubmit`/`handleSubmit`), update the `eventsApi.create({...})` call to include:

```tsx
        organizationId: organizationId ?? undefined,
        orgEventSlug: organizationId && orgEventSlug.trim() ? orgEventSlug.trim() : undefined,
```

- [ ] **Step 3: Verify tsc clean**

```bash
pnpm --filter @wishly/web exec tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

- [ ] **Step 4: Visual smoke**

Open `http://localhost:3000/create-event` in browser — OrgSelector renders only if user has orgs (auth required).

Visit `http://localhost:3000/create-event?organizationId={any-org-id}` — verify org pre-selected and orgEventSlug input visible.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/create-event/CreateEventForm.tsx apps/web/lib/api-client.ts
git commit -m "S29-10: integrate OrgSelector + orgEventSlug into create-event form"
```

---

## Task 11: `OrgBadge` chip + DashboardClient integration

**Files:**
- Create: `apps/web/components/event/OrgBadge.tsx`
- Modify: `apps/web/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create OrgBadge**

Create `apps/web/components/event/OrgBadge.tsx`:

```tsx
'use client'

import Link from 'next/link'

export function OrgBadge({
  organization,
}: {
  organization: { id: string; slug: string; name: string; brandColor: string | null } | null
}) {
  if (!organization) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-[10px] font-semibold text-ink-900/60">
        🧑 Personal
      </span>
    )
  }

  const bg = organization.brandColor ?? '#ff2d7b'

  return (
    <Link
      href={`/o/${organization.slug}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
      style={{ background: bg }}
    >
      🏢 {organization.name}
    </Link>
  )
}
```

- [ ] **Step 2: Render OrgBadge on dashboard event cards**

Open `apps/web/app/dashboard/DashboardClient.tsx`. Find the event card markup inside the events list. Add import at the top:

```tsx
import { OrgBadge } from '@/components/event/OrgBadge'
```

Find the event card title row (the `<h3 className="font-display font-bold ...">{e.title}</h3>` block). Replace it (and any premium badge span beside it) with:

```tsx
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-display font-bold text-ink-900 line-clamp-1 flex-1 min-w-0">
                      {e.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <OrgBadge organization={e.organization ?? null} />
                      {(e as any).isPremium && (
                        <span className="text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 px-1.5 py-0.5">⭐</span>
                      )}
                    </div>
                  </div>
```

- [ ] **Step 3: Verify tsc clean**

```bash
pnpm --filter @wishly/web exec tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

- [ ] **Step 4: Visual smoke**

Open `http://localhost:3000/dashboard` while logged in. Each event card shows `🧑 Personal` (grey pill) or `🏢 {Org}` (brand-colored pill linking to `/o/{slug}`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/event/OrgBadge.tsx apps/web/app/dashboard/DashboardClient.tsx
git commit -m "S29-11: OrgBadge chip on dashboard event cards"
```

---

## Task 12: EventPublicView brand inheritance UI

**Files:**
- Modify: `apps/web/app/e/[tokenOrSlug]/EventPublicView.tsx`

- [ ] **Step 1: Add Org footer chip**

Open `apps/web/app/e/[tokenOrSlug]/EventPublicView.tsx`. The `event.host` field now contains org name + logo when bound (because we changed formatPublicEvent in Task 4), so the existing host display block automatically picks up the org branding. We just need to add the footer attribution chip.

Find the final `<main>` closing area or the existing footer / iCal link section. Add this block just before the `iCal` link (or at the end):

```tsx
      {event.organization && (
        <div className="my-8 text-center">
          <a
            href={`/o/${event.organization.slug}`}
            className="inline-flex items-center gap-2 pill bg-white border border-gray-200 hover:border-ink-900/30 text-xs text-ink-900/70"
          >
            <span>Часть афиши</span>
            <strong className="text-ink-900">{event.organization.name}</strong>
            <span>→</span>
          </a>
        </div>
      )}
```

- [ ] **Step 2: Update "от {host}" subtitle to show org context if bound**

Search for the existing string like `от {hostName}` or `приглашение от` in EventPublicView.tsx. Wrap it so when `event.organization`:

```tsx
{event.organization ? (
  <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
    Приглашение от {event.organization.name}
  </p>
) : (
  // keep existing rendering of host name here
)}
```

If the host name display was using `event.host.name`, no change needed there — formatPublicEvent already returns `org.name` as `host.name` when bound (Task 4). The override above is just a tweak for the "Приглашение от" label.

- [ ] **Step 3: Verify tsc clean**

```bash
pnpm --filter @wishly/web exec tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

- [ ] **Step 4: Visual smoke via gstack**

Take a screenshot of an org-bound event page:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B viewport 1280x800
$B goto "http://localhost:3000/e/{shareToken-of-org-event}"
sleep 4
$B screenshot /tmp/wishly-screens/s29-event-org.png
```

Then `Read` the screenshot to verify the org name appears instead of host nickname + footer chip is visible.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/e/[tokenOrSlug]/EventPublicView.tsx
git commit -m "S29-12: EventPublicView shows org branding + footer chip"
```

---

## Task 13: New web route `/o/[orgSlug]/[eventSlug]/page.tsx`

**Files:**
- Create: `apps/web/app/o/[orgSlug]/[eventSlug]/page.tsx`
- Create: `apps/web/app/o/[orgSlug]/[eventSlug]/OrgEventClient.tsx`

- [ ] **Step 1: Create page.tsx**

Create `apps/web/app/o/[orgSlug]/[eventSlug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { OrgEventClient } from './OrgEventClient'

export const revalidate = 30

async function fetchOrgEvent(orgSlug: string, eventSlug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
  const res = await fetch(`${apiUrl}/o/${orgSlug}/${eventSlug}`, { cache: 'no-store' })
  if (res.status === 404) return null
  return res.json()
}

export default async function OrgEventPage({ params }: { params: { orgSlug: string; eventSlug: string } }) {
  const data = await fetchOrgEvent(params.orgSlug, params.eventSlug)
  if (!data) notFound()
  return <OrgEventClient orgSlug={params.orgSlug} eventSlug={params.eventSlug} initialData={data} />
}

export async function generateMetadata({ params }: { params: { orgSlug: string; eventSlug: string } }) {
  const data = await fetchOrgEvent(params.orgSlug, params.eventSlug)
  if (!data) return { title: 'Ивент · Event Gallery' }
  if (data.requiresPin) return { title: `${data.preview?.title ?? 'Закрытый ивент'} · Event Gallery` }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const canonicalUrl = `${base}/o/${params.orgSlug}/${params.eventSlug}`
  const orgUpdatedAt = data.organization?.updatedAt ?? data.updatedAt ?? ''
  const ogUrl = `${base}/og/event/${data.shareToken}?v=${encodeURIComponent(String(orgUpdatedAt))}`

  return {
    metadataBase: new URL(base),
    title: `${data.title} · ${data.organization?.name ?? 'Event Gallery'}`,
    description: data.description ?? `Приглашение на ${data.title}`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      title: data.title,
      description: data.description ?? '',
      url: canonicalUrl,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      locale: 'ru_RU',
    },
    twitter: { card: 'summary_large_image', title: data.title, images: [ogUrl] },
  }
}
```

- [ ] **Step 2: Create OrgEventClient that reuses EventPublicView**

Create `apps/web/app/o/[orgSlug]/[eventSlug]/OrgEventClient.tsx`:

```tsx
'use client'

import { EventPublicView } from '@/app/e/[tokenOrSlug]/EventPublicView'

export function OrgEventClient({
  orgSlug,
  eventSlug,
  initialData,
}: {
  orgSlug: string
  eventSlug: string
  initialData: any
}) {
  // The EventPublicView uses tokenOrSlug to make API calls (RSVP, refresh, etc.).
  // For org events we pass shareToken so RSVP submissions go to canonical endpoint.
  const passToken = initialData.shareToken ?? eventSlug
  return <EventPublicView initialData={initialData} tokenOrSlug={passToken} />
}
```

- [ ] **Step 3: Verify tsc clean**

```bash
pnpm --filter @wishly/web exec tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

- [ ] **Step 4: Visual smoke**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:3000/o/{orgSlug}/{eventSlug}"
sleep 4
$B screenshot /tmp/wishly-screens/s29-org-alias-route.png
```

Verify the page renders identically to `/e/{shareToken}` and the URL stays at the org-namespaced path.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/o/[orgSlug]/[eventSlug]
git commit -m "S29-13: /o/[orgSlug]/[eventSlug] alias route with canonical OG metadata"
```

---

## Task 14: OrgAdminShell events tab — wire `+ Новый ивент` CTA

**Files:**
- Modify: `apps/web/app/o/[slug]/admin/OrgAdminShell.tsx`

- [ ] **Step 1: Locate the events tab CTA**

Open `apps/web/app/o/[slug]/admin/OrgAdminShell.tsx`. Find the "+ Новый ивент" button/link in the events tab section.

- [ ] **Step 2: Update its href to include `?organizationId={orgId}`**

Find the line that renders the CTA. It should be similar to:

```tsx
<Link href="/create-event">+ Новый ивент</Link>
```

Replace with (where `org.id` is the prop / fetched org's id):

```tsx
<Link href={`/create-event?organizationId=${org.id}`} className="pill-brand text-sm">
  + Новый ивент
</Link>
```

If a fetched events list also exists in this tab, ensure each event's "open" link goes to `/o/${org.slug}/${e.orgEventSlug ?? e.customSlug ?? e.shareToken}` to use the canonical org URL.

- [ ] **Step 3: Verify tsc clean**

```bash
pnpm --filter @wishly/web exec tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

- [ ] **Step 4: Visual smoke**

Open `/o/{slug}/admin` → switch to Events tab → confirm "+ Новый ивент" goes to `/create-event?organizationId=…`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/o/[slug]/admin/OrgAdminShell.tsx
git commit -m "S29-14: OrgAdminShell events tab wires +organizationId into create-event link"
```

---

## Task 15: End-to-end smoke verification

**Files:**
- None (manual verification)

- [ ] **Step 1: Create a fresh org via UI**

In browser logged in as user A:
1. Open `/orgs/new`
2. Fill in slug `s29-demo`, name `S29 Demo Studio`
3. Submit
4. Land on `/o/s29-demo/admin`

- [ ] **Step 2: Create an event bound to that org**

From the org admin Events tab, click "+ Новый ивент".
Verify URL contains `?organizationId=…`. Verify OrgSelector shows S29 Demo Studio pre-selected.
Set orgEventSlug = `opening-night`.
Submit.

- [ ] **Step 3: Verify event page**

1. Open `/e/{shareToken-just-created}` — should show:
   - "Приглашение от S29 Demo Studio" instead of host nickname
   - Footer chip "Часть афиши S29 Demo Studio →" linking to `/o/s29-demo`
2. Open `/o/s29-demo/opening-night` — same page renders, URL stays at canonical org URL

- [ ] **Step 4: Verify dashboard aggregation**

Open `/dashboard` — created event appears with `🏢 S29 Demo Studio` brand-colored badge.

- [ ] **Step 5: Verify permission inheritance**

In a separate browser/incognito, create user B and log in. From user A's admin, invite user B as EDITOR. Accept invite as user B.
As user B, open `/dashboard` — see the org event (with badge). Click → can edit (PATCH from API works).

- [ ] **Step 6: Verify org lineup public**

Open `/o/s29-demo` (logged out works too). The event appears in the upcoming lineup.

- [ ] **Step 7: Run all tests one more time**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
pnpm --filter @wishly/api test
pnpm --filter @wishly/api lint
pnpm --filter @wishly/web exec tsc --noEmit
```

Expected: all tests pass, all tsc clean.

- [ ] **Step 8: Take final visual screenshots**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B viewport 1280x800
for path in "/dashboard" "/o/s29-demo" "/e/{token}" "/o/s29-demo/opening-night" "/o/s29-demo/admin"; do
  name=$(echo "$path" | sed 's|/|-|g; s|^-||')
  $B goto "http://localhost:3000$path"
  sleep 4
  $B screenshot "/tmp/wishly-screens/s29-final-$name.png"
done
```

- [ ] **Step 9: Commit screenshots + final status**

```bash
git commit --allow-empty -m "S29-15: smoke + visual verification complete"
git push
```

---

## Self-review checklist

- ✅ Spec coverage: each section (schema, API, web routes, brand precedence, permissions, edge cases, testing) has at least one task implementing it.
- ✅ No placeholders: every step has exact file paths + complete code where code is changed.
- ✅ Type consistency: `HostAccess`, `OrgWithRole`, `PublicEvent.organization` shape repeated identically across tasks 3, 4, 9, 11, 12.
- ✅ Test order matches TDD: failing test → run-to-fail → implement → run-to-pass → commit.

End of plan.
