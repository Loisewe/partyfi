# Event ↔ Organization Binding — Design Spec

**Date:** 2026-05-29
**Sub-project:** S29 in the B2B-pivot decomposition
**Status:** Approved (brainstorming complete) → ready for implementation plan

---

## Context

After Sprint 26-28 the B2B layer foundation is in place: `Organization`, `OrganizationMember`, `OrganizationSubscription` models exist; CRUD API + public `/o/[slug]` page + admin shell + `/orgs/new` ship. The `Event.organizationId` FK exists but the **end-to-end flow that connects events to orgs is incomplete** — there's no UI to choose org on create, no permission inheritance, no brand pass-through, no canonical org-URL.

This spec defines that binding flow so B2B users (промо-команды, лекторы, конференц-организаторы) can group their events under one brand and let team members collaborate without per-event invites.

---

## Decisions captured in brainstorming

| # | Decision |
|---|---|
| Q1 | Binding chosen **only at event creation**. No later transfer (immutable `organizationId`). |
| Q2 | **Full brand inheritance** from org → event with per-event override (event-level themeColor/coverImageUrl wins). |
| Q3 | **Edit access**: event host **OR** any org `ADMIN`/`EDITOR` can edit. No per-event `EventCoHost` for org-events — org-role replaces it. |
| Q4 | **Aggregated dashboard**: `/dashboard` shows personal + org-events with badges. Org admin shell remains the deep view. |
| Q5 | **Both URLs work**: `/e/{token|slug}` continues as primary; `/o/{orgSlug}/{eventSlug}` added as SEO-friendly alias. |
| Approach | **A — Runtime inheritance**. Minimum schema change; brand resolved at read-time; live re-brand propagates automatically. |

---

## 1. Schema changes (Prisma)

Minimal: two new optional fields + one composite unique.

```prisma
model Event {
  // ... existing fields untouched
  organizationId String?               // existing (Sprint 26)
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)

  // NEW: slug within /o/{orgSlug}/{orgEventSlug} URL
  orgEventSlug String?

  @@unique([organizationId, orgEventSlug])   // NEW, composite. Postgres treats null as distinct.
}

model Organization {
  // ... existing fields untouched
  // NEW: default cover applied to org's events when event has no own cover
  defaultEventCoverUrl String?
}
```

No new tables. `prisma db push` migration, zero data loss.

---

## 2. API changes

### Modified endpoints

| Endpoint | Change |
|---|---|
| `POST /api/v1/events` | Accept `organizationId?` and `orgEventSlug?` in body. Server validates: caller has org-role ≥ `EDITOR` for `organizationId` (else 403); `orgEventSlug` format & uniqueness within org (else 409). |
| `PATCH /api/v1/events/:id` | `organizationId` field **ignored** (immutable). `orgEventSlug` mutable with same validation. |
| `EVENT_INCLUDE` | Adds `organization: { id, slug, name, logoUrl, coverImageUrl, brandColor, accentColor, defaultEventCoverUrl }`. |
| `formatPublicEvent` | Implements inheritance precedence (Section 4) and returns new field `organization: { id, slug, name, logoUrl, brandColor } \| null`. |
| `checkHostAccess` | Extended to recognize org role: if `event.organizationId` and caller is org-`EDITOR`+, treated as host for edit/delete/analytics. |
| `GET /api/v1/events/mine` | Returns events where caller is host **OR** invited guest **OR** member of org with role ≥ `EDITOR`. Each event tagged with `viaOrg: 'editor'/'admin'/'owner'` when reached via org-role. |

### New endpoint

```
GET /api/v1/o/:orgSlug/:eventSlug
```

Resolves: find org by slug → inside its events, match by `orgEventSlug == eventSlug` OR `customSlug == eventSlug` OR `shareToken == eventSlug`. Returns same payload as `GET /api/v1/events/:tokenOrSlug`. Returns 404 if org missing, event missing, or event belongs to a different org.

### Unchanged

- `GET /events/:tokenOrSlug` — primary lookup
- RSVP / photos / analytics / reminders endpoints
- Guest endpoints (no org auth needed)

---

## 3. Web routes / UI

### Modified pages

| File | Change |
|---|---|
| `app/create-event/CreateEventForm.tsx` | Add `OrgSelector` (hidden if user has 0 orgs). Pre-selects from `?organizationId=` query (e.g. from org admin → "Создать ивент"). When org selected: show additional input «URL внутри org» (`orgEventSlug`). |
| `app/dashboard/DashboardClient.tsx` | Event cards get `OrgBadge` chip on the right: «Personal» (grey) or «{Org Name}» (with org brand-color pill). Sort by `startsAt`. |
| `app/e/[tokenOrSlug]/EventPublicView.tsx` | If `event.organization`: hostName → `org.name`, hostAvatar → `org.logoUrl`. Cover area inherits gradient from brandColor if no image. Footer chip «Часть афиши {orgName}» → `/o/{orgSlug}`. |
| `app/o/[slug]/admin/OrgAdminShell.tsx` (events tab) | «+ Новый ивент» CTA → `/create-event?organizationId={id}`. Lists org events. |

### New route

```
app/o/[orgSlug]/[eventSlug]/page.tsx
```

Calls new API endpoint, re-uses existing `EventPublicView` component. `generateMetadata` uses canonical `/o/{orgSlug}/{eventSlug}` URL for OG when org-bound.

### New component

`components/event/OrgSelector.tsx`:
- Props: `value: string | null; onChange(orgId: string | null)`
- On mount: `orgsApi.mine()` (cached)
- Renders: 2-column grid — «Personal» card (🧑) + one card per org (logo/avatar + name + role pill)
- Disables orgs where role = `VIEWER` (can't create events there)

### Unchanged

- Header / OrgSwitcher
- Public `/o/[slug]` page
- TG bot (still emits `/e/{shareToken}` deep links — both URLs valid anyway)
- Photo wall / RSVP / Wrapped components

---

## 4. Brand inheritance precedence

When `event.organizationId` is set, `formatPublicEvent` applies fallback chains (first non-null wins):

| Field in API payload | Chain |
|---|---|
| `coverImageUrl` | `event.coverImageUrl` → `org.defaultEventCoverUrl` → `coverPreset.imageUrl` → `null` (front renders gradient + emoji) |
| `themeColor` | `event.themeColor` (premium) → `mapBrandToTheme(org.brandColor)` → `null` |
| `hostName` | `org.name` if `organizationId` set → `event.host.name ?? nickname` otherwise |
| `hostAvatar` | `org.logoUrl` if `organizationId` set → `event.host.avatarUrl` otherwise |
| `organization` (new field) | `{ id, slug, name, logoUrl, brandColor }` if `organizationId`, else `null` |

`mapBrandToTheme(hex)` — helper in shared package mapping arbitrary hex to nearest of 6 preset themes (`rose/violet/emerald/amber/sky/slate`) by HSL distance. Returns `null` for null input.

**Per-event override:** event-level `themeColor` (premium-gated) and `coverImageUrl` always beat org. Premium custom slug remains per-event.

**Not inherited:** title, description, startsAt, location, agenda, externalLinks, pollQuestion, wishlistId, photo wall, RSVP list.

**Live re-brand:** changing `org.brandColor` / `logoUrl` via `PATCH /organizations/:id` immediately reflects on every org event at next read. No sync-job. This is the killer feature of approach A.

---

## 5. Permissions

| Action | Personal event | Org event |
|---|---|---|
| Public view (ACTIVE, no PIN) | anyone | anyone |
| View (PIN-gated) | knowers of PIN | knowers of PIN |
| Create RSVP / upload photo | any guest | any guest |
| Edit (PATCH) | `hostUserId` OR active `EventCoHost` OR `edit-token` | `hostUserId` OR **org-role ≥ EDITOR** |
| Cancel (DELETE) | same as edit | same as edit |
| Read analytics | same as edit | same as edit **OR** org-role ≥ VIEWER (read-only) |
| Apply premium (TG Stars) | host only | host only (org subscription is separate) |
| Edit `orgEventSlug` | n/a | host OR org-role ≥ ADMIN |
| Change `organizationId` | always blocked (immutable) | always blocked |

`checkHostAccess` now returns: `'host' | 'co-host' | 'org-owner' | 'org-admin' | 'org-editor' | 'org-viewer' | null`. UI treats any non-null as edit-capable; analytics also allows `'org-viewer'`.

### Edge cases

- Org deleted → `Event.organizationId = null` (cascade `SetNull`) → event becomes personal; host retains access via `hostUserId`.
- User removed from org → loses org-derived access immediately on next read.
- Host happens to also be member of the org → removing them from org doesn't strip host access (hostUserId remains).
- Anon-user flow (edit-token) — works only for personal events. Org events require JWT (= org membership).

---

## 6. Edge cases & error handling

### Validation matrix

| Scenario | Status | Body |
|---|---|---|
| `POST /events` org-bound without auth | 401 | `{ error: 'Authentication required' }` |
| `POST /events` role < EDITOR | 403 | `{ error: 'Нет прав создавать ивенты в этой организации' }` |
| `POST /events` org not found | 404 | `{ error: 'Organization not found' }` |
| Duplicate `orgEventSlug` in same org | 409 | `{ error: 'Этот URL уже занят в org' }` |
| `orgEventSlug` bad format (zod) | 400 | zod error |
| `orgEventSlug` reserved (`admin`, `new-event`, `events`, `members`, `brand`, `billing`) | 409 | `{ error: 'Этот URL зарезервирован' }` |
| `PATCH /events/:id` tries to change `organizationId` | 200 | field silently ignored |
| `GET /o/:orgSlug/:eventSlug` org missing | 404 | `{ error: 'Organization not found' }` |
| `GET /o/:orgSlug/:eventSlug` event from different org | 404 | `{ error: 'Event not found' }` |
| `GET /o/:orgSlug/:eventSlug` PIN-gated | 200 | `{ requiresPin: true, preview }` |
| `EVENT_INCLUDE.organization` returns null mid-render | 200 | `organization: null` in payload, formatter falls back to personal-mode |

### OG image cache invalidation

OG routes use immutable cache (`max-age=1y`). To bust on org rebrand, `generateMetadata` for `/o/{orgSlug}/{eventSlug}` includes `?v={max(event.updatedAt, org.updatedAt).getTime()}` query parameter in the OG URL.

### Migration safety

- Both new fields are nullable → zero-impact on existing rows.
- Composite unique `(organizationId, orgEventSlug)` with both nullable → Postgres treats nulls as distinct → no constraint violations for existing data.
- `prisma db push` zero-downtime, no destructive ops.

---

## 7. Testing strategy

### Unit tests (`apps/api/tests/event-org.test.ts`)

- `mapBrandToTheme()` — every preset hex → correct theme name; null → null.
- `checkHostAccess()` — table-driven:
  - personal event + editToken → `'host'`
  - personal event + non-host user → `null`
  - org event + org-EDITOR member → `'org-editor'`
  - org event + org-VIEWER member → `null` for edit, allowed for analytics
  - org event + non-member auth user → `null`
  - org event + EDITOR but binding null (after SetNull) → `null`
- `formatPublicEvent` precedence — each chain step verified.

### Integration tests

Extend existing event suite (or create if missing):

- `POST /events` with `organizationId`: VIEWER → 403; EDITOR → 201; non-member → 403; missing org → 404
- `POST /events` with duplicate `orgEventSlug` → 409
- `GET /o/:orgSlug/:eventSlug` resolves via all 4 fallback ways; cross-org mismatch → 404
- `PATCH /events/:id` from org-EDITOR (not host) → 200; from VIEWER → 403
- `GET /events/mine` returns personal + invited + org-EDITOR events with correct `viaOrg`
- Brand inheritance: event no themeColor + org brandColor → response has mapped theme

### Smoke (manual via curl)

Documented sequence:
1. Create org → create event under it → verify `/events/{shareToken}` shows inherited org
2. Verify `/o/{orgSlug}/{eventSlug}` works
3. Verify `/o/{orgSlug}/events` lists it
4. Delete org → event becomes personal (`organizationId: null`)

### Visual smoke (gstack)

- `/o/{orgSlug}/admin` events tab shows list
- `/create-event?organizationId={id}` preselects org
- `/e/{token}` for org-event shows org branding (logo + name instead of host nickname)
- `/dashboard` shows org-events with `OrgBadge`

### Out of scope

- Performance / load tests
- E2E browser tests (Playwright)
- Migration rollback (db push mode)

### Acceptance criteria

- All unit + integration tests pass
- TSC clean across api / web / bot
- Smoke flow passes manually
- Visual screenshots attached to commit

---

## Implementation hint for the plan phase

Recommended order (low-risk → user-facing):

1. **Schema + Prisma client regen** (`Event.orgEventSlug` + `Organization.defaultEventCoverUrl` + composite unique)
2. **Helpers**: `mapBrandToTheme()` in shared; extend `checkHostAccess` in `utils/event-auth.ts`
3. **API**: extend `POST /events`, `PATCH /events`, `EVENT_INCLUDE`, `formatPublicEvent`, `GET /events/mine`; new `GET /o/:orgSlug/:eventSlug`
4. **Tests** (units + integration green before UI)
5. **Web**: `OrgSelector` component, `CreateEventForm` integration, `OrgBadge` chip, dashboard merge, `EventPublicView` brand inheritance
6. **New route** `app/o/[orgSlug]/[eventSlug]/page.tsx` + canonical OG metadata
7. **Org admin events tab** wires `?organizationId=` query into create-event
8. **Smoke + visual screenshots**
9. **Commit + push**

End of design.
