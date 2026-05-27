# Wishly Events Sprint 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Доставить рабочий MVP создания ивентов с RSVP-механикой и публичными страницами (только web layout — без TG Mini App). После Sprint 1 хост должен мочь: создать ивент с веб-формы, кинуть ссылку, гость может RSVP-нуть анонимно или авторизованно, хост видит список гостей в реальном времени.

**Architecture:** Расширение существующей `wishly` monorepo. Reuse: auth-плагин (`request.auth.user`/`editToken`), Prisma client, Redis pub/sub (SSE), pattern wishlists-роута. Новое: Prisma модели `Event`/`EventRsvp`/`EventCoverPreset`/`EventReminder`/`EventUpgrade`, Fastify-роуты под `/api/v1/events`, Next.js страницы под `/e/[tokenOrSlug]`, `/create-event`.

**Tech Stack:** Существующий — Next.js 14.2.18 + Fastify 4 + Prisma 5 + Postgres + Redis (ioredis) + zod + react-query + react-hook-form + tailwind + framer-motion + lucide-react. Новые зависимости: `bcryptjs` (для PIN-хеша), `ical-generator` (для .ics экспорта).

**Out of scope (Sprint 2+):** Photo wall, reminders worker, cover presets UI, wishlist attachment, custom slug (премиум), TG Mini App layout, TG Stars платежи. Эти задачи покрываются Sprint 2 и Sprint 3.

**Testing Strategy:** Сознательный отход от строгого TDD — пет-проект, нет существующей test-инфры, 3-нед дедлайн. Заменяем: (a) ручной smoke-test после каждой основной задачи через curl + Prisma Studio, (b) E2E integration smoke-test (Task 13) в конце спринта, (c) Vitest unit-тесты только для чистых утилит (нет в Sprint 1, появятся в Sprint 2 для iCal формата если будут баги).

---

## File Structure

### Created

| Path | Responsibility |
|------|----------------|
| `packages/db/prisma/migrations/0_init/migration.sql` | Baseline миграция текущей schema (закрывает риск №1 из аудита) |
| `packages/db/prisma/migrations/1_events/migration.sql` | Новые таблицы events, event_rsvps, event_cover_presets, event_reminders, event_upgrades + расширение users |
| `packages/db/prisma/seed.ts` | Seed-скрипт для cover-presets |
| `packages/db/prisma/seed-data/event-covers.ts` | Данные 20+ обложек (массив объектов) |
| `packages/shared/src/schemas/event.schema.ts` | Zod-схемы input/output для events и RSVP |
| `packages/shared/src/types/event.ts` | TypeScript типы для UI |
| `apps/api/src/routes/events/index.ts` | Fastify-роутер для events CRUD + RSVP + iCal + PIN |
| `apps/api/src/services/event-rsvp.service.ts` | Domain-логика upsert RSVP, валидация, SSE publish |
| `apps/api/src/utils/event-formatter.ts` | Форматтеры event для public/owner views (по аналогии с wishlists) |
| `apps/api/src/utils/event-ical.ts` | Генерация .ics через ical-generator |
| `apps/web/app/create-event/page.tsx` | Страница создания ивента |
| `apps/web/app/create-event/CreateEventForm.tsx` | Форма (client component, react-hook-form + zod) |
| `apps/web/app/e/[tokenOrSlug]/page.tsx` | Публичная страница ивента (server component) |
| `apps/web/app/e/[tokenOrSlug]/EventPublicView.tsx` | Layout публичной страницы (client) |
| `apps/web/app/e/[tokenOrSlug]/RsvpForm.tsx` | Форма RSVP (client, react-hook-form) |
| `apps/web/app/e/[tokenOrSlug]/GuestList.tsx` | Список гостей с группировкой по статусу |
| `apps/web/app/e/[tokenOrSlug]/PinGate.tsx` | Модалка с вводом PIN если ивент защищён |
| `apps/web/app/e/[tokenOrSlug]/host/page.tsx` | Host-страница (редактирование, статистика) |
| `apps/web/app/e/[tokenOrSlug]/host/HostDashboard.tsx` | Layout host-режима |
| `apps/web/app/e/[tokenOrSlug]/not-found.tsx` | 404 для ивента |
| `apps/web/lib/use-event-stream.ts` | React hook для SSE подписки на event-канал |

### Modified

| Path | Change |
|------|--------|
| `packages/db/prisma/schema.prisma` | Добавить Event, EventRsvp, EventCoverPreset, EventReminder, EventUpgrade модели + enums; расширить User (telegramId, telegramUsername, обратные relations) |
| `packages/db/package.json` | Уже есть `seed` script; добавить `prisma.seed` поле для авто-сида |
| `packages/shared/src/types/index.ts` | Export event types |
| `packages/shared/src/schemas/index.ts` | Export event schemas |
| `apps/api/src/index.ts` | Register `eventRoutes` под `/api/v1/events` |
| `apps/api/package.json` | Add `bcryptjs`, `ical-generator`, `@types/bcryptjs` |
| `apps/api/src/routes/sse/index.ts` | Добавить event-канал (по аналогии с wishlist-каналом) |
| `apps/web/app/dashboard/DashboardClient.tsx` | Добавить секцию "Мои ивенты" |
| `apps/web/app/page.tsx` | Добавить второй CTA "Создать ивент" |
| `apps/web/lib/api-client.ts` | Добавить event API методы (создать/получить/RSVP) |

---

## Tasks

### Task 1: Bootstrap — захват baseline миграции

**Files:**
- Create: `packages/db/prisma/migrations/0_init/migration.sql`
- Create: `packages/db/prisma/migrations/migration_lock.toml`

Аудит показал: миграций нет, schema живёт только в коде через `prisma db push`. Перед добавлением новых таблиц нужно зафиксировать существующее состояние как baseline-миграцию, иначе любое `prisma migrate dev` снесёт всё.

- [ ] **Step 1: Сгенерировать baseline SQL из текущей schema**

```bash
cd packages/db
mkdir -p prisma/migrations/0_init
pnpm prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

Expected: файл `migration.sql` содержит CREATE TABLE для users, wishlists, wishlist_items, reservations, group_gift_participants, kitties, payments + enums + indexes. Должно быть ~250 строк SQL.

- [ ] **Step 2: Создать migration_lock.toml**

```bash
cat > packages/db/prisma/migrations/migration_lock.toml <<'EOF'
provider = "postgresql"
EOF
```

- [ ] **Step 3: Применить baseline как уже применённую (БД уже накатана через push)**

Если в локальной БД уже есть таблицы (от предыдущего `db push`), нужно сказать Prisma "это baseline уже накатан". Если БД пустая — обычный migrate dev.

```bash
# Если БД уже наполнена — пометить baseline как applied:
pnpm prisma migrate resolve --applied 0_init

# Если БД свежая — обычный путь:
# pnpm prisma migrate deploy
```

Expected: `prisma migrate status` показывает `Database schema is up to date!`.

- [ ] **Step 4: Verify через `prisma migrate status`**

```bash
pnpm prisma migrate status
```

Expected output: `Database schema is up to date!` без warnings.

- [ ] **Step 5: Commit (без git — пометить чекпоинт в TaskList)**

Проект пока без git. Зафиксируем прогресс через TaskCreate чекпоинт: "Baseline migration captured — БД готова к добавлению event-моделей".

---

### Task 2: Расширить schema — Event-модели + User-расширение

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (добавить ~150 строк в конец)

- [ ] **Step 1: Расширить User-модель**

Найти существующую `model User` (строки ~22-44). Заменить блок relations + добавить TG-поля:

```prisma
model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Authenticated fields (null for anonymous)
  email         String? @unique
  name          String?
  avatarUrl     String?
  oauthProvider String?
  oauthId       String?

  // Anonymous identity
  nickname    String?
  isAnonymous Boolean @default(true)

  // Telegram identity (Sprint 3 — добавлено заранее чтобы не мигрировать дважды)
  telegramId       String? @unique
  telegramUsername String?

  // Relations
  wishlists    Wishlist[]
  reservations Reservation[]
  hostedEvents Event[]      @relation("EventHost")
  guestRsvps   EventRsvp[]  @relation("GuestRsvps")

  @@unique([oauthProvider, oauthId])
  @@index([email])
  @@index([telegramId])
  @@map("users")
}
```

- [ ] **Step 2: Добавить Event-модели в конец schema.prisma**

Дописать в конец файла:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// EVENT
// Casual event invitations with RSVP. Wishlist attachment is optional.
// shareToken → public URL /e/[shareToken]
// customSlug → premium-only pretty URL /e/[customSlug]
// editToken  → anon host edit credential
// ─────────────────────────────────────────────────────────────────────────────

model Event {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  hostUserId String
  host       User   @relation("EventHost", fields: [hostUserId], references: [id], onDelete: Cascade)
  editToken  String @unique @default(cuid())

  title         String
  description   String?
  startsAt      DateTime
  endsAt        DateTime?
  timezone      String   @default("Europe/Moscow")
  location      String?
  locationLink  String?

  coverPresetId String?
  coverPreset   EventCoverPreset? @relation(fields: [coverPresetId], references: [id])
  coverImageUrl String?

  shareToken String  @unique @default(cuid())
  customSlug String? @unique
  pinHash    String?

  rsvpVisibility   RsvpVisibility @default(ALL_GUESTS)
  remindersEnabled Boolean        @default(true)

  wishlistId String?
  wishlist   Wishlist? @relation(fields: [wishlistId], references: [id], onDelete: SetNull)

  status         EventStatus @default(ACTIVE)
  cancelMessage  String?

  rsvps     EventRsvp[]
  photos    EventPhoto[]
  reminders EventReminder[]
  upgrade   EventUpgrade?
  views     EventView[]

  @@index([hostUserId])
  @@index([startsAt])
  @@index([shareToken])
  @@index([editToken])
  @@map("events")
}

model EventRsvp {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  eventId     String
  event       Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  guestUserId String
  guest       User   @relation("GuestRsvps", fields: [guestUserId], references: [id])

  status          RsvpStatus
  plusOnes        Int        @default(0)
  message         String?
  cancelTokenHash String?    @unique

  @@unique([eventId, guestUserId])
  @@index([eventId, status])
  @@map("event_rsvps")
}

model EventPhoto {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  eventId        String
  event          Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
  uploaderUserId String

  r2Key     String
  width     Int
  height    Int
  sizeBytes Int

  @@index([eventId, createdAt])
  @@map("event_photos")
}

model EventReminder {
  id        String   @id @default(cuid())

  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  triggerAt DateTime
  kind      ReminderKind
  sentAt    DateTime?

  @@index([triggerAt, sentAt])
  @@map("event_reminders")
}

model EventUpgrade {
  id                String   @id @default(cuid())
  createdAt         DateTime @default(now())

  eventId           String   @unique
  event             Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  purchaserUserId   String
  starsAmount       Int
  tgPaymentChargeId String   @unique
  features          Json

  @@map("event_upgrades")
}

model EventCoverPreset {
  id           String   @id @default(cuid())
  slug         String   @unique
  imageUrl     String
  occasionTags String[]
  displayOrder Int      @default(0)

  events Event[]

  @@map("event_cover_presets")
}

model EventView {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  eventId    String
  event      Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  viewerHash String  // SHA-256(IP + UA + day) — unique-ish без хранения PII

  @@index([eventId, createdAt])
  @@index([eventId, viewerHash])
  @@map("event_views")
}

enum RsvpVisibility {
  ALL_GUESTS
  HOST_ONLY
}

enum EventStatus {
  ACTIVE
  CANCELLED
  ARCHIVED
}

enum RsvpStatus {
  GOING
  MAYBE
  NOT_GOING
}

enum ReminderKind {
  T_24H
  T_2H
  CUSTOM
}
```

- [ ] **Step 3: Сгенерировать миграцию**

```bash
cd packages/db
pnpm prisma migrate dev --name events --create-only
```

Expected: появится `packages/db/prisma/migrations/<timestamp>_events/migration.sql`. `--create-only` не применяет миграцию автоматически — сначала посмотрим что сгенерировалось.

- [ ] **Step 4: Inspect migration SQL**

Открыть сгенерированный файл и убедиться:
- CREATE TABLE для events, event_rsvps, event_photos, event_reminders, event_upgrades, event_cover_presets, event_views
- ALTER TABLE users ADD COLUMN telegramId, telegramUsername
- Все CREATE INDEX как описано
- Foreign keys корректны (ON DELETE CASCADE для child-таблиц, SET NULL для wishlist)

- [ ] **Step 5: Применить миграцию**

```bash
pnpm prisma migrate deploy
pnpm prisma generate
```

Expected: `Database schema is up to date!` + новые типы в `node_modules/.prisma/client`.

- [ ] **Step 6: Verify через Prisma Studio**

```bash
pnpm prisma studio
```

Открыть в браузере — должны быть видны новые таблицы пустыми. Закрыть.

---

### Task 3: Seed cover presets

**Files:**
- Create: `packages/db/prisma/seed.ts`
- Create: `packages/db/prisma/seed-data/event-covers.ts`
- Modify: `packages/db/package.json` (добавить `prisma.seed` поле)

- [ ] **Step 1: Создать seed-data файл**

Файл `packages/db/prisma/seed-data/event-covers.ts`:

```typescript
export const eventCoverPresets = [
  // Birthday — 8 обложек
  { slug: 'birthday-balloons',    imageUrl: 'https://cdn.wishly.app/covers/birthday-balloons.webp',    occasionTags: ['birthday'], displayOrder: 1 },
  { slug: 'birthday-cake',        imageUrl: 'https://cdn.wishly.app/covers/birthday-cake.webp',        occasionTags: ['birthday'], displayOrder: 2 },
  { slug: 'birthday-confetti',    imageUrl: 'https://cdn.wishly.app/covers/birthday-confetti.webp',    occasionTags: ['birthday'], displayOrder: 3 },
  { slug: 'birthday-disco',       imageUrl: 'https://cdn.wishly.app/covers/birthday-disco.webp',       occasionTags: ['birthday', 'party'], displayOrder: 4 },
  { slug: 'birthday-pastel',      imageUrl: 'https://cdn.wishly.app/covers/birthday-pastel.webp',      occasionTags: ['birthday', 'kids'], displayOrder: 5 },
  { slug: 'birthday-vintage',     imageUrl: 'https://cdn.wishly.app/covers/birthday-vintage.webp',     occasionTags: ['birthday'], displayOrder: 6 },
  { slug: 'birthday-minimal',     imageUrl: 'https://cdn.wishly.app/covers/birthday-minimal.webp',     occasionTags: ['birthday'], displayOrder: 7 },
  { slug: 'birthday-tropical',    imageUrl: 'https://cdn.wishly.app/covers/birthday-tropical.webp',    occasionTags: ['birthday', 'summer'], displayOrder: 8 },

  // Housewarming — 4
  { slug: 'housewarming-keys',    imageUrl: 'https://cdn.wishly.app/covers/housewarming-keys.webp',    occasionTags: ['housewarming'], displayOrder: 9 },
  { slug: 'housewarming-plants',  imageUrl: 'https://cdn.wishly.app/covers/housewarming-plants.webp',  occasionTags: ['housewarming'], displayOrder: 10 },
  { slug: 'housewarming-coffee',  imageUrl: 'https://cdn.wishly.app/covers/housewarming-coffee.webp',  occasionTags: ['housewarming'], displayOrder: 11 },
  { slug: 'housewarming-keys-bw', imageUrl: 'https://cdn.wishly.app/covers/housewarming-keys-bw.webp', occasionTags: ['housewarming', 'minimal'], displayOrder: 12 },

  // Casual / party — 6
  { slug: 'party-neon',           imageUrl: 'https://cdn.wishly.app/covers/party-neon.webp',           occasionTags: ['party', 'casual'], displayOrder: 13 },
  { slug: 'party-cocktail',       imageUrl: 'https://cdn.wishly.app/covers/party-cocktail.webp',       occasionTags: ['party', 'casual'], displayOrder: 14 },
  { slug: 'party-dance',          imageUrl: 'https://cdn.wishly.app/covers/party-dance.webp',          occasionTags: ['party'], displayOrder: 15 },
  { slug: 'gathering-cozy',       imageUrl: 'https://cdn.wishly.app/covers/gathering-cozy.webp',       occasionTags: ['casual'], displayOrder: 16 },
  { slug: 'gathering-dinner',     imageUrl: 'https://cdn.wishly.app/covers/gathering-dinner.webp',     occasionTags: ['casual', 'dinner'], displayOrder: 17 },
  { slug: 'gathering-bbq',        imageUrl: 'https://cdn.wishly.app/covers/gathering-bbq.webp',        occasionTags: ['casual', 'summer'], displayOrder: 18 },

  // Wedding / engagement — 3
  { slug: 'wedding-rings',        imageUrl: 'https://cdn.wishly.app/covers/wedding-rings.webp',        occasionTags: ['wedding'], displayOrder: 19 },
  { slug: 'wedding-floral',       imageUrl: 'https://cdn.wishly.app/covers/wedding-floral.webp',      occasionTags: ['wedding'], displayOrder: 20 },
  { slug: 'engagement-champagne', imageUrl: 'https://cdn.wishly.app/covers/engagement-champagne.webp', occasionTags: ['engagement'], displayOrder: 21 },

  // Baby shower — 2
  { slug: 'baby-shower-blue',     imageUrl: 'https://cdn.wishly.app/covers/baby-shower-blue.webp',     occasionTags: ['baby-shower'], displayOrder: 22 },
  { slug: 'baby-shower-pink',     imageUrl: 'https://cdn.wishly.app/covers/baby-shower-pink.webp',     occasionTags: ['baby-shower'], displayOrder: 23 },
]
```

Картинки на R2 будут залиты отдельным шагом — сейчас seed работает с URL'ами которые могут быть 404. Это OK: для MVP UI просто покажет placeholder если изображение не загружается. Реальные обложки можно нагенерить или подобрать перед deploy.

- [ ] **Step 2: Создать seed.ts**

Файл `packages/db/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { eventCoverPresets } from './seed-data/event-covers'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding event cover presets...')

  for (const preset of eventCoverPresets) {
    await prisma.eventCoverPreset.upsert({
      where: { slug: preset.slug },
      update: {
        imageUrl: preset.imageUrl,
        occasionTags: preset.occasionTags,
        displayOrder: preset.displayOrder,
      },
      create: preset,
    })
  }

  console.log(`Seeded ${eventCoverPresets.length} event cover presets.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Добавить `prisma.seed` поле в package.json**

Открыть `packages/db/package.json`, добавить блок:

```json
{
  "name": "@wishly/db",
  ...
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 4: Запустить seed**

```bash
cd packages/db
pnpm prisma db seed
```

Expected output:
```
Seeding event cover presets...
Seeded 23 event cover presets.
```

- [ ] **Step 5: Verify через Prisma Studio**

```bash
pnpm prisma studio
```

В таблице `event_cover_presets` должно быть 23 записи. Закрыть.

---

### Task 4: Shared zod-схемы + типы для events

**Files:**
- Create: `packages/shared/src/schemas/event.schema.ts`
- Create: `packages/shared/src/types/event.ts`
- Modify: `packages/shared/src/schemas/index.ts` (export)
- Modify: `packages/shared/src/types/index.ts` (export)

- [ ] **Step 1: Создать event.schema.ts**

Файл `packages/shared/src/schemas/event.schema.ts`:

```typescript
import { z } from 'zod'

export const createEventSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(120),
  description: z.string().max(2000).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().max(64).default('Europe/Moscow'),
  location: z.string().max(500).optional(),
  locationLink: z.string().url().max(2000).optional(),
  coverPresetId: z.string().cuid().optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN должен быть из 4 цифр').optional(),
  wishlistId: z.string().cuid().optional(),
  rsvpVisibility: z.enum(['ALL_GUESTS', 'HOST_ONLY']).default('ALL_GUESTS'),
  remindersEnabled: z.boolean().default(true),
})

export const updateEventSchema = createEventSchema.partial().extend({
  cancelMessage: z.string().max(500).optional(),
})

export const cancelEventSchema = z.object({
  cancelMessage: z.string().min(1, 'Укажите причину').max(500),
})

export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
})

export const createRsvpSchema = z.object({
  status: z.enum(['GOING', 'MAYBE', 'NOT_GOING']),
  plusOnes: z.number().int().min(0).max(10).default(0),
  message: z.string().max(500).optional(),
  guestDisplayName: z.string().min(1).max(100).optional(),
})

export type CreateEventInput  = z.infer<typeof createEventSchema>
export type UpdateEventInput  = z.infer<typeof updateEventSchema>
export type CancelEventInput  = z.infer<typeof cancelEventSchema>
export type VerifyPinInput    = z.infer<typeof verifyPinSchema>
export type CreateRsvpInput   = z.infer<typeof createRsvpSchema>
```

- [ ] **Step 2: Создать types/event.ts**

Файл `packages/shared/src/types/event.ts`:

```typescript
import type { PublicUser } from './user'

export type RsvpStatus = 'GOING' | 'MAYBE' | 'NOT_GOING'
export type EventStatus = 'ACTIVE' | 'CANCELLED' | 'ARCHIVED'
export type RsvpVisibility = 'ALL_GUESTS' | 'HOST_ONLY'

export interface PublicEvent {
  id: string
  title: string
  description: string | null
  startsAt: string         // ISO
  endsAt: string | null
  timezone: string
  location: string | null
  locationLink: string | null
  coverImageUrl: string | null
  coverPresetSlug: string | null
  shareToken: string
  customSlug: string | null
  status: EventStatus
  cancelMessage: string | null
  rsvpVisibility: RsvpVisibility
  hasPinProtection: boolean
  host: PublicUser
  wishlist: {
    id: string
    name: string
    shareToken: string
    itemCount: number
  } | null
  rsvpStats: {
    going: number
    maybe: number
    notGoing: number
    plusOnesTotal: number
  }
  isPremium: boolean
  createdAt: string
}

export interface OwnerEvent extends PublicEvent {
  editToken: string
}

export interface PublicGuest {
  id: string                  // rsvp.id
  status: RsvpStatus
  plusOnes: number
  message: string | null
  guest: PublicUser
  respondedAt: string
}

export interface MyRsvp {
  status: RsvpStatus
  plusOnes: number
  message: string | null
  cancelToken?: string        // только в ответе POST (анон)
}
```

- [ ] **Step 3: Update schemas/index.ts**

Открыть `packages/shared/src/schemas/index.ts`, добавить:

```typescript
export * from './wishlist.schema'
export * from './event.schema'
```

- [ ] **Step 4: Update types/index.ts**

Открыть `packages/shared/src/types/index.ts`, добавить:

```typescript
export * from './user'
export * from './wishlist'
export * from './scrape'
export * from './event'
```

- [ ] **Step 5: TypeCheck**

```bash
cd packages/shared
pnpm tsc --noEmit
```

Expected: no errors.

---

### Task 5: API — events route (CRUD + PIN)

**Files:**
- Create: `apps/api/src/routes/events/index.ts`
- Create: `apps/api/src/utils/event-formatter.ts`
- Modify: `apps/api/package.json` (добавить `bcryptjs`, `@types/bcryptjs`, `ical-generator`)

- [ ] **Step 1: Установить зависимости**

```bash
cd apps/api
pnpm add bcryptjs ical-generator
pnpm add -D @types/bcryptjs
```

- [ ] **Step 2: Создать event-formatter.ts**

Файл `apps/api/src/utils/event-formatter.ts`:

```typescript
import type { Event, EventCoverPreset, User, Wishlist } from '@wishly/db'
import type { PublicEvent, OwnerEvent, PublicUser, PublicGuest, RsvpStatus } from '@wishly/shared'

type EventWithRelations = Event & {
  host: User
  coverPreset: EventCoverPreset | null
  wishlist: (Wishlist & { _count: { items: number } }) | null
  rsvps: Array<{ status: string; plusOnes: number }>
  upgrade: { id: string } | null
}

export function formatUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    isAnonymous: user.isAnonymous,
  }
}

export function formatPublicEvent(event: EventWithRelations): PublicEvent {
  const rsvpStats = event.rsvps.reduce(
    (acc, r) => {
      if (r.status === 'GOING')      acc.going++
      if (r.status === 'MAYBE')      acc.maybe++
      if (r.status === 'NOT_GOING')  acc.notGoing++
      acc.plusOnesTotal += r.plusOnes
      return acc
    },
    { going: 0, maybe: 0, notGoing: 0, plusOnesTotal: 0 },
  )

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    timezone: event.timezone,
    location: event.location,
    locationLink: event.locationLink,
    coverImageUrl: event.coverImageUrl ?? event.coverPreset?.imageUrl ?? null,
    coverPresetSlug: event.coverPreset?.slug ?? null,
    shareToken: event.shareToken,
    customSlug: event.customSlug,
    status: event.status as 'ACTIVE' | 'CANCELLED' | 'ARCHIVED',
    cancelMessage: event.cancelMessage,
    rsvpVisibility: event.rsvpVisibility as 'ALL_GUESTS' | 'HOST_ONLY',
    hasPinProtection: !!event.pinHash,
    host: formatUser(event.host),
    wishlist: event.wishlist
      ? {
          id: event.wishlist.id,
          name: event.wishlist.name,
          shareToken: event.wishlist.shareToken,
          itemCount: event.wishlist._count.items,
        }
      : null,
    rsvpStats,
    isPremium: !!event.upgrade,
    createdAt: event.createdAt.toISOString(),
  }
}

export function formatOwnerEvent(event: EventWithRelations): OwnerEvent {
  return {
    ...formatPublicEvent(event),
    editToken: event.editToken,
  }
}

export function formatGuestList(
  rsvps: Array<{
    id: string
    status: string
    plusOnes: number
    message: string | null
    updatedAt: Date
    guest: User
  }>,
  visibility: 'ALL_GUESTS' | 'HOST_ONLY',
  isHost: boolean,
): PublicGuest[] {
  if (visibility === 'HOST_ONLY' && !isHost) return []

  return rsvps.map((r) => ({
    id: r.id,
    status: r.status as RsvpStatus,
    plusOnes: r.plusOnes,
    message: r.message,
    guest: formatUser(r.guest),
    respondedAt: r.updatedAt.toISOString(),
  }))
}
```

- [ ] **Step 3: Создать events route**

Файл `apps/api/src/routes/events/index.ts`:

```typescript
import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'
import {
  createEventSchema,
  updateEventSchema,
  cancelEventSchema,
  verifyPinSchema,
  createRsvpSchema,
  generateNickname,
} from '@wishly/shared'
import { requireAuth } from '../../plugins/auth'
import { formatPublicEvent, formatOwnerEvent, formatGuestList } from '../../utils/event-formatter'

const EVENT_INCLUDE = {
  host: true,
  coverPreset: true,
  wishlist: { include: { _count: { select: { items: true } } } },
  rsvps: { select: { status: true, plusOnes: true } },
  upgrade: { select: { id: true } },
} as const

export const eventRoutes: FastifyPluginAsync = async (app) => {

  // ── POST /events ────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = createEventSchema.parse(request.body)

    let userId: string
    if (request.auth.user) {
      userId = request.auth.user.id
    } else {
      const newUser = await app.prisma.user.create({
        data: { isAnonymous: true, nickname: generateNickname() },
      })
      userId = newUser.id
    }

    const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null

    const event = await app.prisma.event.create({
      data: {
        hostUserId: userId,
        title: body.title,
        description: body.description ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        timezone: body.timezone,
        location: body.location ?? null,
        locationLink: body.locationLink ?? null,
        coverPresetId: body.coverPresetId ?? null,
        wishlistId: body.wishlistId ?? null,
        pinHash,
        rsvpVisibility: body.rsvpVisibility,
        remindersEnabled: body.remindersEnabled,
      },
      include: EVENT_INCLUDE,
    })

    reply.status(201)
    return {
      event: formatOwnerEvent(event),
      editToken: request.auth.user ? undefined : event.editToken,
    }
  })

  // ── GET /events/:tokenOrSlug ────────────────────────────────────────────
  // Если установлен PIN — возвращаем минимальный объект (host name + title + cover) + флаг hasPinProtection.
  // Полные данные только после verify-pin (через X-Event-Pin header).
  app.get('/:tokenOrSlug', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const submittedPin = request.headers['x-event-pin'] as string | undefined

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      include: EVENT_INCLUDE,
    })

    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const isHost =
      request.auth.editToken === event.editToken ||
      request.auth.user?.id === event.hostUserId

    // PIN-gate
    if (event.pinHash && !isHost) {
      if (!submittedPin) {
        // Минимальный preview без приватных полей
        return {
          requiresPin: true,
          preview: {
            id: event.id,
            title: event.title,
            coverImageUrl: event.coverImageUrl ?? event.coverPreset?.imageUrl ?? null,
            hostName: event.host.name ?? event.host.nickname,
          },
        }
      }
      const ok = await bcrypt.compare(submittedPin, event.pinHash)
      if (!ok) return reply.status(403).send({ error: 'Неверный PIN' })
    }

    // Track view (idempotent на день для одного "viewer")
    const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip
    const ua = request.headers['user-agent'] ?? ''
    const day = new Date().toISOString().slice(0, 10)
    const viewerHash = createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex')

    await app.prisma.eventView.upsert({
      where: { id: `${event.id}_${viewerHash}` }, // упрощение: уникальность через комбинированный id
      update: {},
      create: { id: `${event.id}_${viewerHash}`, eventId: event.id, viewerHash },
    }).catch(() => {/* ignore tracking errors */})

    return isHost ? formatOwnerEvent(event) : formatPublicEvent(event)
  })

  // ── POST /events/:tokenOrSlug/verify-pin ────────────────────────────────
  // Возвращает true/false. Для UI-логики — после успеха клиент перезапрашивает GET с pin в header.
  app.post('/:tokenOrSlug/verify-pin', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const body = verifyPinSchema.parse(request.body)

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { pinHash: true },
    })

    if (!event || !event.pinHash) return reply.status(404).send({ error: 'Event not found' })

    const ok = await bcrypt.compare(body.pin, event.pinHash)
    return { valid: ok }
  })

  // ── PATCH /events/:id ───────────────────────────────────────────────────
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateEventSchema.parse(request.body)

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const isHost =
      request.auth.editToken === event.editToken ||
      request.auth.user?.id === event.hostUserId
    if (!isHost) return reply.status(403).send({ error: 'Access denied' })

    const data: Record<string, unknown> = {}
    if (body.title !== undefined)            data.title = body.title
    if (body.description !== undefined)      data.description = body.description
    if (body.startsAt !== undefined)         data.startsAt = new Date(body.startsAt)
    if (body.endsAt !== undefined)           data.endsAt = body.endsAt ? new Date(body.endsAt) : null
    if (body.timezone !== undefined)         data.timezone = body.timezone
    if (body.location !== undefined)         data.location = body.location
    if (body.locationLink !== undefined)     data.locationLink = body.locationLink
    if (body.coverPresetId !== undefined)    data.coverPresetId = body.coverPresetId
    if (body.wishlistId !== undefined)       data.wishlistId = body.wishlistId
    if (body.rsvpVisibility !== undefined)   data.rsvpVisibility = body.rsvpVisibility
    if (body.remindersEnabled !== undefined) data.remindersEnabled = body.remindersEnabled
    if (body.cancelMessage !== undefined)    data.cancelMessage = body.cancelMessage
    if (body.pin !== undefined)              data.pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null

    const updated = await app.prisma.event.update({
      where: { id },
      data,
      include: EVENT_INCLUDE,
    })

    // SSE publish
    await app.redis.publish(`event:${id}`, JSON.stringify({ type: 'event.updated', eventId: id }))

    return formatOwnerEvent(updated)
  })

  // ── DELETE /events/:id (мягкое — status=CANCELLED) ─────────────────────
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = cancelEventSchema.parse(request.body)

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const isHost =
      request.auth.editToken === event.editToken ||
      request.auth.user?.id === event.hostUserId
    if (!isHost) return reply.status(403).send({ error: 'Access denied' })

    const updated = await app.prisma.event.update({
      where: { id },
      data: { status: 'CANCELLED', cancelMessage: body.cancelMessage },
      include: EVENT_INCLUDE,
    })

    await app.redis.publish(`event:${id}`, JSON.stringify({ type: 'event.cancelled', eventId: id }))

    return formatOwnerEvent(updated)
  })

  // ── POST /events/:tokenOrSlug/rsvp ──────────────────────────────────────
  app.post('/:tokenOrSlug/rsvp', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const body = createRsvpSchema.parse(request.body)

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { id: true, status: true, pinHash: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.status === 'CANCELLED') return reply.status(410).send({ error: 'Event cancelled' })

    if (event.pinHash) {
      const pin = request.headers['x-event-pin'] as string | undefined
      const ok = pin ? await bcrypt.compare(pin, event.pinHash) : false
      if (!ok) return reply.status(403).send({ error: 'PIN required' })
    }

    // Identify guest
    let guestUserId: string
    let cancelToken: string | undefined
    if (request.auth.user) {
      guestUserId = request.auth.user.id
    } else {
      const newUser = await app.prisma.user.create({
        data: {
          isAnonymous: true,
          nickname: body.guestDisplayName ?? generateNickname(),
          name: body.guestDisplayName ?? null,
        },
      })
      guestUserId = newUser.id
      cancelToken = randomBytes(32).toString('hex')
    }

    const cancelTokenHash = cancelToken
      ? createHash('sha256').update(cancelToken).digest('hex')
      : null

    const rsvp = await app.prisma.eventRsvp.upsert({
      where: { eventId_guestUserId: { eventId: event.id, guestUserId } },
      update: {
        status: body.status,
        plusOnes: body.plusOnes,
        message: body.message ?? null,
      },
      create: {
        eventId: event.id,
        guestUserId,
        status: body.status,
        plusOnes: body.plusOnes,
        message: body.message ?? null,
        cancelTokenHash,
      },
    })

    await app.redis.publish(
      `event:${event.id}`,
      JSON.stringify({ type: 'rsvp.upserted', eventId: event.id, rsvpId: rsvp.id, status: rsvp.status }),
    )

    return {
      rsvp: {
        status: rsvp.status,
        plusOnes: rsvp.plusOnes,
        message: rsvp.message,
        cancelToken,  // только для анон, чтобы потом отменить
      },
    }
  })

  // ── DELETE /events/:tokenOrSlug/rsvp ────────────────────────────────────
  app.delete('/:tokenOrSlug/rsvp', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }
    const cancelToken = request.headers['x-cancel-token'] as string | undefined

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { id: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    let where: { id: string } | { eventId_guestUserId: { eventId: string; guestUserId: string } } | null = null
    if (request.auth.user) {
      where = { eventId_guestUserId: { eventId: event.id, guestUserId: request.auth.user.id } }
    } else if (cancelToken) {
      const hash = createHash('sha256').update(cancelToken).digest('hex')
      const rsvp = await app.prisma.eventRsvp.findFirst({ where: { eventId: event.id, cancelTokenHash: hash } })
      if (!rsvp) return reply.status(404).send({ error: 'RSVP not found' })
      where = { id: rsvp.id }
    } else {
      return reply.status(401).send({ error: 'Auth required' })
    }

    const rsvp = await app.prisma.eventRsvp.delete({ where })
    await app.redis.publish(
      `event:${event.id}`,
      JSON.stringify({ type: 'rsvp.deleted', eventId: event.id, rsvpId: rsvp.id }),
    )
    reply.status(204)
  })

  // ── GET /events/:tokenOrSlug/guests ─────────────────────────────────────
  app.get('/:tokenOrSlug/guests', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      select: { id: true, hostUserId: true, editToken: true, rsvpVisibility: true, pinHash: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    if (event.pinHash) {
      const pin = request.headers['x-event-pin'] as string | undefined
      const isHost =
        request.auth.editToken === event.editToken ||
        request.auth.user?.id === event.hostUserId
      if (!isHost) {
        const ok = pin ? await bcrypt.compare(pin, event.pinHash) : false
        if (!ok) return reply.status(403).send({ error: 'PIN required' })
      }
    }

    const rsvps = await app.prisma.eventRsvp.findMany({
      where: { eventId: event.id },
      include: { guest: true },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    })

    const isHost =
      request.auth.editToken === event.editToken ||
      request.auth.user?.id === event.hostUserId

    return { guests: formatGuestList(rsvps, event.rsvpVisibility as 'ALL_GUESTS' | 'HOST_ONLY', isHost) }
  })

  // ── GET /events/mine ────────────────────────────────────────────────────
  app.get('/mine', async (request, reply) => {
    const user = requireAuth(request)
    const events = await app.prisma.event.findMany({
      where: { OR: [{ hostUserId: user.id }, { rsvps: { some: { guestUserId: user.id } } }] },
      include: EVENT_INCLUDE,
      orderBy: { startsAt: 'asc' },
    })
    return { events: events.map(formatPublicEvent) }
  })
}
```

- [ ] **Step 4: Лёгкая `viewerHash` уникальность через `@@unique` constraint (важно — иначе upsert по id неправильный)**

Вернуться в `packages/db/prisma/schema.prisma`, в модель `EventView` заменить:

```prisma
model EventView {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  eventId    String
  event      Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  viewerHash String

  @@unique([eventId, viewerHash])
  @@index([eventId, createdAt])
  @@map("event_views")
}
```

И поправить upsert в route (Step 3 уже содержит упрощение через комбинированный id, но правильнее через unique constraint). Заменить в `events/index.ts` блок `app.prisma.eventView.upsert`:

```typescript
await app.prisma.eventView.upsert({
  where: { eventId_viewerHash: { eventId: event.id, viewerHash } },
  update: {},
  create: { eventId: event.id, viewerHash },
}).catch(() => {/* ignore tracking errors */})
```

Создать новую миграцию:

```bash
cd packages/db
pnpm prisma migrate dev --name event_views_unique
```

- [ ] **Step 5: TypeCheck**

```bash
cd apps/api
pnpm lint
```

Expected: 0 errors.

---

### Task 6: API — iCal export

**Files:**
- Create: `apps/api/src/utils/event-ical.ts`
- Modify: `apps/api/src/routes/events/index.ts` (добавить GET /:tokenOrSlug/ical)

- [ ] **Step 1: Создать event-ical.ts**

Файл `apps/api/src/utils/event-ical.ts`:

```typescript
import ical, { ICalCalendarMethod } from 'ical-generator'
import type { Event } from '@wishly/db'

export function buildIcs(event: Event, hostName: string, publicUrl: string): string {
  const cal = ical({
    name: `Wishly · ${event.title}`,
    prodId: { company: 'Wishly', product: 'Events', language: 'RU' },
    method: ICalCalendarMethod.PUBLISH,
  })

  cal.createEvent({
    id: event.id,
    start: event.startsAt,
    end: event.endsAt ?? new Date(event.startsAt.getTime() + 3 * 60 * 60 * 1000), // default 3 hours
    summary: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    url: publicUrl,
    organizer: { name: hostName, email: 'noreply@wishly.app' },
    timezone: event.timezone,
  })

  return cal.toString()
}
```

- [ ] **Step 2: Добавить роут в events/index.ts**

Дописать в конце функции `eventRoutes` перед закрывающей `}`:

```typescript
  // ── GET /events/:tokenOrSlug/ical ───────────────────────────────────────
  app.get('/:tokenOrSlug/ical', async (request, reply) => {
    const { tokenOrSlug } = request.params as { tokenOrSlug: string }

    const event = await app.prisma.event.findFirst({
      where: { OR: [{ shareToken: tokenOrSlug }, { customSlug: tokenOrSlug }] },
      include: { host: true },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.pinHash) return reply.status(403).send({ error: 'PIN-protected events cannot be exported' })

    const { buildIcs } = await import('../../utils/event-ical')
    const hostName = event.host.name ?? event.host.nickname ?? 'Host'
    const publicUrl = `${process.env.WEB_URL ?? 'http://localhost:3000'}/e/${event.customSlug ?? event.shareToken}`
    const ics = buildIcs(event, hostName, publicUrl)

    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${event.customSlug ?? event.shareToken}.ics"`)
      .send(ics)
  })
```

- [ ] **Step 3: TypeCheck**

```bash
cd apps/api
pnpm lint
```

---

### Task 7: SSE — добавить event-канал

**Files:**
- Modify: `apps/api/src/routes/sse/index.ts`

- [ ] **Step 1: Прочитать существующий sse route**

```bash
cat apps/api/src/routes/sse/index.ts
```

Понять как сделан wishlist-канал. Скорее всего есть параметр `channel` или path `/sse/wishlist/:id`.

- [ ] **Step 2: Добавить event-эндпоинт**

В `apps/api/src/routes/sse/index.ts` добавить по аналогии с существующим wishlist SSE (детали зависят от конкретной реализации — копировать паттерн):

```typescript
  // ── GET /sse/event/:eventId ─────────────────────────────────────────────
  app.get('/sse/event/:eventId', async (request, reply) => {
    const { eventId } = request.params as { eventId: string }

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders?.()

    const subscriber = app.redis.duplicate()
    await subscriber.subscribe(`event:${eventId}`)

    subscriber.on('message', (_channel, message) => {
      reply.raw.write(`data: ${message}\n\n`)
    })

    request.raw.on('close', () => {
      subscriber.unsubscribe().then(() => subscriber.disconnect()).catch(() => {})
    })
  })
```

Если в существующем sse уже есть универсальная функция подписки — переиспользовать её.

- [ ] **Step 3: TypeCheck**

```bash
cd apps/api && pnpm lint
```

---

### Task 8: Register events route в API

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Добавить импорт**

В `apps/api/src/index.ts` около других route-импортов (строки ~13-19) добавить:

```typescript
import { eventRoutes } from './routes/events'
```

- [ ] **Step 2: Зарегистрировать роут**

В блоке `// ── Routes` (~строки 80-86) добавить:

```typescript
  await app.register(eventRoutes, { prefix: '/api/v1/events' })
```

- [ ] **Step 3: Smoke-тест API**

Запустить docker-compose и dev:

```bash
docker-compose up -d
pnpm dev
```

В отдельном терминале — curl-тесты:

```bash
# Создать ивент (анон)
curl -X POST http://localhost:3001/api/v1/events \
  -H 'Content-Type: application/json' \
  -d '{
    "title":"Тестовый ивент",
    "startsAt":"2026-06-15T19:00:00+03:00",
    "location":"Москва"
  }'
# Expected: 201, { event: {...}, editToken: "..." }

# Запомнить shareToken и editToken из ответа
SHARE_TOKEN=...
EDIT_TOKEN=...

# Получить ивент публично
curl http://localhost:3001/api/v1/events/$SHARE_TOKEN
# Expected: { id, title, ..., rsvpStats: {going: 0, ...}, isPremium: false }

# RSVP анонимно
curl -X POST http://localhost:3001/api/v1/events/$SHARE_TOKEN/rsvp \
  -H 'Content-Type: application/json' \
  -d '{"status":"GOING","plusOnes":1,"guestDisplayName":"Тест Гость"}'
# Expected: { rsvp: { status: "GOING", plusOnes: 1, cancelToken: "..." } }

# Получить список гостей
curl http://localhost:3001/api/v1/events/$SHARE_TOKEN/guests
# Expected: { guests: [{ id, status: "GOING", plusOnes: 1, guest: { name: "Тест Гость" } }] }

# Обновить ивент (как анон-хост)
curl -X PATCH http://localhost:3001/api/v1/events/<EVENT_ID> \
  -H 'Content-Type: application/json' \
  -H "X-Edit-Token: $EDIT_TOKEN" \
  -d '{"title":"Обновлённое название"}'
# Expected: 200, обновлённый event

# Отменить
curl -X DELETE http://localhost:3001/api/v1/events/<EVENT_ID> \
  -H 'Content-Type: application/json' \
  -H "X-Edit-Token: $EDIT_TOKEN" \
  -d '{"cancelMessage":"Заболел"}'
# Expected: 200, event.status === "CANCELLED"

# iCal export
curl http://localhost:3001/api/v1/events/$SHARE_TOKEN/ical -o test.ics
cat test.ics
# Expected: валидный VCALENDAR с BEGIN:VEVENT...END:VEVENT
```

Если все 6 запросов отрабатывают как ожидается — Task 5-8 закрыты, API готов.

---

### Task 9: Web — API client расширение

**Files:**
- Modify: `apps/web/lib/api-client.ts`

- [ ] **Step 1: Прочитать существующий api-client**

```bash
cat apps/web/lib/api-client.ts
```

Понять паттерн: используется ли fetch напрямую, есть ли базовый класс, как передаётся auth-token.

- [ ] **Step 2: Добавить event-методы**

В конец `apps/web/lib/api-client.ts` дописать (адаптировать под существующий паттерн):

```typescript
import type {
  PublicEvent,
  OwnerEvent,
  PublicGuest,
  CreateEventInput,
  UpdateEventInput,
  CancelEventInput,
  CreateRsvpInput,
} from '@wishly/shared'

export const eventsApi = {
  async create(input: CreateEventInput): Promise<{ event: OwnerEvent; editToken?: string }> {
    return apiFetch('/events', { method: 'POST', body: JSON.stringify(input) })
  },

  async get(
    tokenOrSlug: string,
    opts?: { pin?: string },
  ): Promise<{ requiresPin: true; preview: any } | PublicEvent | OwnerEvent> {
    const headers: Record<string, string> = {}
    if (opts?.pin) headers['X-Event-Pin'] = opts.pin
    return apiFetch(`/events/${tokenOrSlug}`, { headers })
  },

  async verifyPin(tokenOrSlug: string, pin: string): Promise<{ valid: boolean }> {
    return apiFetch(`/events/${tokenOrSlug}/verify-pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    })
  },

  async update(id: string, editToken: string | undefined, input: UpdateEventInput): Promise<OwnerEvent> {
    const headers: Record<string, string> = {}
    if (editToken) headers['X-Edit-Token'] = editToken
    return apiFetch(`/events/${id}`, { method: 'PATCH', headers, body: JSON.stringify(input) })
  },

  async cancel(id: string, editToken: string | undefined, input: CancelEventInput): Promise<OwnerEvent> {
    const headers: Record<string, string> = {}
    if (editToken) headers['X-Edit-Token'] = editToken
    return apiFetch(`/events/${id}`, { method: 'DELETE', headers, body: JSON.stringify(input) })
  },

  async rsvp(
    tokenOrSlug: string,
    input: CreateRsvpInput,
    opts?: { pin?: string },
  ): Promise<{ rsvp: { status: string; plusOnes: number; message: string | null; cancelToken?: string } }> {
    const headers: Record<string, string> = {}
    if (opts?.pin) headers['X-Event-Pin'] = opts.pin
    return apiFetch(`/events/${tokenOrSlug}/rsvp`, { method: 'POST', headers, body: JSON.stringify(input) })
  },

  async cancelRsvp(tokenOrSlug: string, cancelToken?: string): Promise<void> {
    const headers: Record<string, string> = {}
    if (cancelToken) headers['X-Cancel-Token'] = cancelToken
    await apiFetch(`/events/${tokenOrSlug}/rsvp`, { method: 'DELETE', headers })
  },

  async guests(
    tokenOrSlug: string,
    opts?: { pin?: string },
  ): Promise<{ guests: PublicGuest[] }> {
    const headers: Record<string, string> = {}
    if (opts?.pin) headers['X-Event-Pin'] = opts.pin
    return apiFetch(`/events/${tokenOrSlug}/guests`, { headers })
  },

  async mine(): Promise<{ events: PublicEvent[] }> {
    return apiFetch('/events/mine')
  },

  icalUrl(tokenOrSlug: string): string {
    return `${API_BASE_URL}/api/v1/events/${tokenOrSlug}/ical`
  },
}
```

`apiFetch` и `API_BASE_URL` — это существующие хелперы. Если их имена другие — адаптировать.

- [ ] **Step 3: TypeCheck**

```bash
cd apps/web && pnpm lint
```

---

### Task 10: Web — /create-event страница и форма

**Files:**
- Create: `apps/web/app/create-event/page.tsx`
- Create: `apps/web/app/create-event/CreateEventForm.tsx`

- [ ] **Step 1: Создать page.tsx**

Файл `apps/web/app/create-event/page.tsx`:

```typescript
import { CreateEventForm } from './CreateEventForm'

export const metadata = {
  title: 'Создать ивент · Wishly',
}

export default function CreateEventPage() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Создать ивент</h1>
      <CreateEventForm />
    </main>
  )
}
```

- [ ] **Step 2: Создать CreateEventForm.tsx**

Файл `apps/web/app/create-event/CreateEventForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createEventSchema, type CreateEventInput } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'

export function CreateEventForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      timezone: 'Europe/Moscow',
      rsvpVisibility: 'ALL_GUESTS',
      remindersEnabled: true,
    },
  })

  async function onSubmit(data: CreateEventInput) {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const result = await eventsApi.create(data)
      if (result.editToken) {
        localStorage.setItem(`wishly_event_edit_${result.event.id}`, result.editToken)
      }
      router.push(`/e/${result.event.shareToken}/host`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Ошибка создания ивента')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Название *</label>
        <input
          {...register('title')}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="День рождения Ани"
        />
        {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Описание</label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Праздничный ужин, дресс-код casual"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Начало *</label>
          <input
            {...register('startsAt')}
            type="datetime-local"
            className="w-full px-3 py-2 border rounded-lg"
          />
          {errors.startsAt && <p className="text-red-600 text-sm mt-1">{errors.startsAt.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Конец</label>
          <input
            {...register('endsAt')}
            type="datetime-local"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Место</label>
        <input
          {...register('location')}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Москва, кафе «У Ани», ул. Пушкина 10"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Ссылка на карту/Zoom</label>
        <input
          {...register('locationLink')}
          type="url"
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="https://yandex.ru/maps/..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">4-значный PIN (опционально)</label>
        <input
          {...register('pin')}
          inputMode="numeric"
          maxLength={4}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="0000"
        />
        <p className="text-xs text-gray-500 mt-1">Защищает ивент от случайных прохожих по ссылке</p>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('rsvpVisibility')} value="HOST_ONLY" />
          <span className="text-sm">Скрыть список гостей от других гостей (видно только хосту)</span>
        </label>
      </div>

      {serverError && <p className="text-red-600 text-sm">{serverError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-3 bg-black text-white rounded-lg font-medium disabled:opacity-50"
      >
        {isSubmitting ? 'Создаём…' : 'Создать ивент'}
      </button>
    </form>
  )
}
```

Стилизация минимальная (vanilla Tailwind) — реальный дизайн доводим в Sprint 3 polish-фазе.

---

### Task 11: Web — публичная страница ивента + RSVP

**Files:**
- Create: `apps/web/app/e/[tokenOrSlug]/page.tsx`
- Create: `apps/web/app/e/[tokenOrSlug]/EventPublicView.tsx`
- Create: `apps/web/app/e/[tokenOrSlug]/RsvpForm.tsx`
- Create: `apps/web/app/e/[tokenOrSlug]/GuestList.tsx`
- Create: `apps/web/app/e/[tokenOrSlug]/PinGate.tsx`
- Create: `apps/web/app/e/[tokenOrSlug]/not-found.tsx`
- Create: `apps/web/lib/use-event-stream.ts`

- [ ] **Step 1: Создать page.tsx (server component с ISR)**

Файл `apps/web/app/e/[tokenOrSlug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { EventPublicView } from './EventPublicView'

export const revalidate = 30 // ISR — пересобираем страницу каждые 30 сек, real-time идёт через SSE

async function fetchEvent(tokenOrSlug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/events/${tokenOrSlug}`, { cache: 'no-store' })
  if (res.status === 404) return null
  return res.json()
}

export default async function EventPage({ params }: { params: { tokenOrSlug: string } }) {
  const data = await fetchEvent(params.tokenOrSlug)
  if (!data) notFound()
  return <EventPublicView initialData={data} tokenOrSlug={params.tokenOrSlug} />
}

export async function generateMetadata({ params }: { params: { tokenOrSlug: string } }) {
  const data = await fetchEvent(params.tokenOrSlug)
  if (!data || data.requiresPin) return { title: 'Ивент · Wishly' }
  return {
    title: `${data.title} · Wishly`,
    description: data.description ?? `Приглашение на ${data.title}`,
    openGraph: {
      title: data.title,
      description: data.description ?? '',
      images: data.coverImageUrl ? [data.coverImageUrl] : [],
    },
  }
}
```

- [ ] **Step 2: Создать EventPublicView (client orchestrator)**

Файл `apps/web/app/e/[tokenOrSlug]/EventPublicView.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { PublicEvent } from '@wishly/shared'
import { PinGate } from './PinGate'
import { RsvpForm } from './RsvpForm'
import { GuestList } from './GuestList'
import { useEventStream } from '@/lib/use-event-stream'
import { eventsApi } from '@/lib/api-client'

interface Props {
  initialData: any  // может быть PublicEvent или { requiresPin: true, preview }
  tokenOrSlug: string
}

export function EventPublicView({ initialData, tokenOrSlug }: Props) {
  const [pin, setPin] = useState<string | undefined>()
  const [event, setEvent] = useState<PublicEvent | null>(
    initialData.requiresPin ? null : (initialData as PublicEvent),
  )
  const [pinPreview] = useState(initialData.requiresPin ? initialData.preview : null)

  useEventStream(event?.id, async () => {
    const refreshed = await eventsApi.get(tokenOrSlug, { pin })
    if (!('requiresPin' in refreshed)) setEvent(refreshed as PublicEvent)
  })

  async function onPinSubmit(submittedPin: string) {
    const refreshed = await eventsApi.get(tokenOrSlug, { pin: submittedPin })
    if ('requiresPin' in refreshed) {
      throw new Error('Неверный PIN')
    }
    setPin(submittedPin)
    setEvent(refreshed as PublicEvent)
  }

  if (!event) {
    return <PinGate preview={pinPreview} onPinSubmit={onPinSubmit} />
  }

  if (event.status === 'CANCELLED') {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-2 line-through opacity-60">{event.title}</h1>
        <p className="text-red-600 font-medium">Ивент отменён</p>
        {event.cancelMessage && <p className="mt-2 text-gray-600">{event.cancelMessage}</p>}
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      {event.coverImageUrl && (
        <img
          src={event.coverImageUrl}
          alt=""
          className="w-full h-48 object-cover rounded-2xl mb-6"
        />
      )}
      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
      <p className="text-gray-600 mb-4">
        {new Date(event.startsAt).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' })}
      </p>
      {event.location && <p className="mb-2">📍 {event.location}</p>}
      {event.description && <p className="my-4 whitespace-pre-wrap">{event.description}</p>}

      <div className="my-6 border-t pt-6">
        <RsvpForm tokenOrSlug={tokenOrSlug} pin={pin} eventId={event.id} />
      </div>

      <div className="my-6 border-t pt-6">
        <GuestList tokenOrSlug={tokenOrSlug} pin={pin} eventId={event.id} stats={event.rsvpStats} />
      </div>

      <div className="my-6 border-t pt-6 text-sm text-gray-500">
        <a
          href={eventsApi.icalUrl(tokenOrSlug)}
          className="underline"
        >
          📅 Добавить в календарь (.ics)
        </a>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Создать RsvpForm**

Файл `apps/web/app/e/[tokenOrSlug]/RsvpForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRsvpSchema, type CreateRsvpInput, type RsvpStatus } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'

interface Props {
  tokenOrSlug: string
  pin?: string
  eventId: string
}

const STATUS_LABELS: Record<RsvpStatus, string> = {
  GOING: 'Иду 🎉',
  MAYBE: 'Может быть 🤔',
  NOT_GOING: 'Не смогу 😔',
}

export function RsvpForm({ tokenOrSlug, pin }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelToken, setCancelToken] = useState<string | undefined>(
    typeof window !== 'undefined' ? localStorage.getItem(`wishly_rsvp_${tokenOrSlug}`) ?? undefined : undefined,
  )

  const { register, handleSubmit, watch } = useForm<CreateRsvpInput>({
    resolver: zodResolver(createRsvpSchema),
    defaultValues: { status: 'GOING', plusOnes: 0 },
  })

  const status = watch('status')

  async function onSubmit(data: CreateRsvpInput) {
    setError(null)
    try {
      const res = await eventsApi.rsvp(tokenOrSlug, data, { pin })
      if (res.rsvp.cancelToken) {
        localStorage.setItem(`wishly_rsvp_${tokenOrSlug}`, res.rsvp.cancelToken)
        setCancelToken(res.rsvp.cancelToken)
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки')
    }
  }

  async function cancelRsvp() {
    await eventsApi.cancelRsvp(tokenOrSlug, cancelToken)
    localStorage.removeItem(`wishly_rsvp_${tokenOrSlug}`)
    setCancelToken(undefined)
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <div className="text-center">
        <p className="text-lg mb-2">Ответ сохранён: {STATUS_LABELS[status]}</p>
        <button onClick={cancelRsvp} className="text-sm underline text-gray-600">
          Отменить мой ответ
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-xl font-semibold">Твой ответ</h2>

      <div>
        <label className="block text-sm font-medium mb-2">Как ты?</label>
        <div className="flex gap-2">
          {(['GOING', 'MAYBE', 'NOT_GOING'] as RsvpStatus[]).map((s) => (
            <label key={s} className="flex-1 cursor-pointer">
              <input type="radio" {...register('status')} value={s} className="sr-only peer" />
              <div className="px-3 py-2 border rounded-lg text-center peer-checked:bg-black peer-checked:text-white">
                {STATUS_LABELS[s]}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">+1, +2…</label>
        <input
          {...register('plusOnes', { valueAsNumber: true })}
          type="number"
          min={0}
          max={10}
          className="w-24 px-3 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Имя (если без аккаунта)</label>
        <input
          {...register('guestDisplayName')}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Аня"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Комментарий хосту</label>
        <textarea
          {...register('message')}
          rows={2}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Принесу торт"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" className="w-full px-4 py-3 bg-black text-white rounded-lg font-medium">
        Отправить
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Создать GuestList**

Файл `apps/web/app/e/[tokenOrSlug]/GuestList.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { PublicGuest } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'

interface Props {
  tokenOrSlug: string
  pin?: string
  eventId: string
  stats: { going: number; maybe: number; notGoing: number; plusOnesTotal: number }
}

export function GuestList({ tokenOrSlug, pin, stats }: Props) {
  const [guests, setGuests] = useState<PublicGuest[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await eventsApi.guests(tokenOrSlug, { pin })
      setGuests(res.guests)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tokenOrSlug, pin])

  const going    = guests.filter((g) => g.status === 'GOING')
  const maybe    = guests.filter((g) => g.status === 'MAYBE')
  const notGoing = guests.filter((g) => g.status === 'NOT_GOING')

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">
        Гости — идут {stats.going}{stats.plusOnesTotal > 0 && ` (+${stats.plusOnesTotal})`} · может быть {stats.maybe} · не идут {stats.notGoing}
      </h2>

      {loading ? (
        <p className="text-gray-500">Загружаем…</p>
      ) : guests.length === 0 ? (
        <p className="text-gray-500">Пока никто не ответил. Будь первым!</p>
      ) : (
        <>
          {going.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-green-700 mb-1">Идут</h3>
              <ul className="space-y-1">
                {going.map((g) => (
                  <li key={g.id} className="flex items-center gap-2">
                    <span>{g.guest.name ?? g.guest.nickname}</span>
                    {g.plusOnes > 0 && <span className="text-sm text-gray-500">+{g.plusOnes}</span>}
                    {g.message && <span className="text-sm text-gray-600 italic">— {g.message}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {maybe.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-yellow-700 mb-1">Может быть</h3>
              <ul className="space-y-1">
                {maybe.map((g) => <li key={g.id}>{g.guest.name ?? g.guest.nickname}</li>)}
              </ul>
            </div>
          )}
          {notGoing.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Не идут</h3>
              <ul className="space-y-1 text-gray-500">
                {notGoing.map((g) => <li key={g.id}>{g.guest.name ?? g.guest.nickname}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Создать PinGate**

Файл `apps/web/app/e/[tokenOrSlug]/PinGate.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface Props {
  preview: { id: string; title: string; coverImageUrl: string | null; hostName: string | null }
  onPinSubmit: (pin: string) => Promise<void>
}

export function PinGate({ preview, onPinSubmit }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onPinSubmit(pin)
    } catch (err) {
      setError('Неверный PIN')
      setSubmitting(false)
    }
  }

  return (
    <main className="container mx-auto max-w-md px-4 py-12 text-center">
      {preview.coverImageUrl && (
        <img src={preview.coverImageUrl} alt="" className="w-full h-40 object-cover rounded-2xl mb-4" />
      )}
      <h1 className="text-2xl font-bold mb-1">{preview.title}</h1>
      <p className="text-gray-600 mb-6">от {preview.hostName ?? 'хоста'}</p>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-gray-700">Этот ивент защищён PIN. Введи 4 цифры:</p>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          autoFocus
          className="w-32 px-3 py-3 text-2xl text-center tracking-widest border rounded-lg mx-auto"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={pin.length !== 4 || submitting}
          className="w-full px-4 py-3 bg-black text-white rounded-lg font-medium disabled:opacity-50"
        >
          Открыть ивент
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 6: Создать not-found.tsx**

Файл `apps/web/app/e/[tokenOrSlug]/not-found.tsx`:

```typescript
export default function NotFound() {
  return (
    <main className="container mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl font-bold mb-2">Ивент не найден</h1>
      <p className="text-gray-600">Проверь ссылку — возможно она устарела или ивент был отменён.</p>
    </main>
  )
}
```

- [ ] **Step 7: Создать use-event-stream hook**

Файл `apps/web/lib/use-event-stream.ts`:

```typescript
'use client'

import { useEffect } from 'react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export function useEventStream(eventId: string | undefined, onMessage: () => void) {
  useEffect(() => {
    if (!eventId) return
    const es = new EventSource(`${API_BASE_URL}/api/v1/sse/event/${eventId}`)
    es.onmessage = () => onMessage()
    return () => es.close()
  }, [eventId, onMessage])
}
```

- [ ] **Step 8: TypeCheck**

```bash
cd apps/web && pnpm lint
```

---

### Task 12: Web — host-страница

**Files:**
- Create: `apps/web/app/e/[tokenOrSlug]/host/page.tsx`
- Create: `apps/web/app/e/[tokenOrSlug]/host/HostDashboard.tsx`

- [ ] **Step 1: Создать page.tsx**

Файл `apps/web/app/e/[tokenOrSlug]/host/page.tsx`:

```typescript
import { HostDashboard } from './HostDashboard'

export default function HostPage({ params }: { params: { tokenOrSlug: string } }) {
  return <HostDashboard tokenOrSlug={params.tokenOrSlug} />
}
```

- [ ] **Step 2: Создать HostDashboard**

Файл `apps/web/app/e/[tokenOrSlug]/host/HostDashboard.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OwnerEvent } from '@wishly/shared'
import { eventsApi } from '@/lib/api-client'

interface Props { tokenOrSlug: string }

export function HostDashboard({ tokenOrSlug }: Props) {
  const router = useRouter()
  const [event, setEvent] = useState<OwnerEvent | null>(null)
  const [editToken, setEditToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelMessage, setCancelMessage] = useState('')

  useEffect(() => {
    const stored = Object.entries(localStorage).find(
      ([k]) => k.startsWith('wishly_event_edit_'),
    )
    const token = stored?.[1] ?? null
    setEditToken(token)

    eventsApi.get(tokenOrSlug).then((data) => {
      if ('requiresPin' in data) {
        setError('PIN-защищённый ивент — открой по основной ссылке')
        return
      }
      if (!('editToken' in data)) {
        setError('Ты не хост этого ивента')
        return
      }
      setEvent(data as OwnerEvent)
    })
  }, [tokenOrSlug])

  async function cancelEvent() {
    if (!event || !editToken) return
    if (!cancelMessage.trim()) {
      alert('Укажи причину отмены')
      return
    }
    if (!confirm(`Отменить "${event.title}"?`)) return
    const updated = await eventsApi.cancel(event.id, editToken, { cancelMessage })
    setEvent(updated)
  }

  if (error) return <main className="container mx-auto max-w-2xl px-4 py-12">{error}</main>
  if (!event) return <main className="container mx-auto max-w-2xl px-4 py-12">Загружаем…</main>

  const inviteUrl = `${window.location.origin}/e/${event.customSlug ?? event.shareToken}`

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <button onClick={() => router.push(`/e/${tokenOrSlug}`)} className="text-sm text-gray-600 underline mb-4">
        ← Открыть как гость
      </button>

      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
      <p className="text-gray-600 mb-6">
        {new Date(event.startsAt).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' })}
      </p>

      <div className="my-6 border-t pt-6">
        <h2 className="text-lg font-semibold mb-2">Поделиться</h2>
        <div className="flex gap-2">
          <input value={inviteUrl} readOnly className="flex-1 px-3 py-2 border rounded-lg bg-gray-50" />
          <button
            onClick={() => navigator.clipboard.writeText(inviteUrl)}
            className="px-4 py-2 bg-black text-white rounded-lg"
          >
            Скопировать
          </button>
        </div>
      </div>

      <div className="my-6 border-t pt-6">
        <h2 className="text-lg font-semibold mb-2">Гости</h2>
        <p>{event.rsvpStats.going} идут (+{event.rsvpStats.plusOnesTotal}) · {event.rsvpStats.maybe} может быть · {event.rsvpStats.notGoing} не идут</p>
      </div>

      {event.status === 'ACTIVE' && (
        <div className="my-6 border-t pt-6">
          <h2 className="text-lg font-semibold mb-2 text-red-700">Отменить ивент</h2>
          <textarea
            value={cancelMessage}
            onChange={(e) => setCancelMessage(e.target.value)}
            placeholder="Причина (увидят все гости)"
            rows={2}
            className="w-full px-3 py-2 border rounded-lg mb-2"
          />
          <button onClick={cancelEvent} className="px-4 py-2 border border-red-600 text-red-700 rounded-lg">
            Отменить ивент
          </button>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: TypeCheck**

```bash
cd apps/web && pnpm lint
```

---

### Task 13: E2E smoke test

**Files:** (нет создаваемых — ручной тест)

- [ ] **Step 1: Запустить полный стек**

```bash
cd /Users/loisewe/Documents/claude/Personal/Projs/wishlist
docker-compose up -d
pnpm dev
```

Дождаться: API на :3001, Web на :3000.

- [ ] **Step 2: Сценарий "хост-анон создаёт ивент"**

1. Открыть http://localhost:3000/create-event в incognito
2. Заполнить: название "Тестовая днюха", дата завтра 19:00, место "Кафе", PIN "1234"
3. Нажать "Создать ивент"
4. Должно редиректнуть на `/e/<shareToken>/host`
5. Должен показаться dashboard хоста с invite-ссылкой и статистикой 0/0/0

- [ ] **Step 3: Сценарий "гость-анон отвечает RSVP"**

1. Скопировать invite-ссылку из dashboard
2. Открыть в **другом incognito-окне**
3. Должен показаться PIN-gate с превью ивента
4. Ввести "1234" → откроется страница
5. Заполнить RSVP-форму: "Иду", +1, имя "Тест Гость"
6. Нажать "Отправить" → должно показать "Ответ сохранён"

- [ ] **Step 4: Сценарий "хост видит RSVP в реальном времени"**

1. Вернуться в первое окно (host dashboard)
2. Reload — статистика должна показать "1 идут (+1) · 0 может быть · 0 не идут"
3. Если SSE работает корректно — обновление произойдёт без reload (тест: открыть страницу гостя, изменить RSVP с GOING на MAYBE — на host-странице должна автоматически обновиться статистика)

- [ ] **Step 5: Сценарий "отмена ивента"**

1. На host-странице ввести "Заболел" в "Отменить ивент"
2. Подтвердить
3. Открыть гостевую страницу — должна показывать "Ивент отменён" с причиной

- [ ] **Step 6: iCal export**

```bash
curl http://localhost:3001/api/v1/events/<shareToken>/ical -o test.ics
cat test.ics
```

Expected: валидный VCALENDAR. Открыть в Apple Calendar / Google Calendar — должен импортироваться корректно.

Note: для PIN-защищённых ивентов iCal вернёт 403 — это документировано в коде, тест ожидает создание второго ивента без PIN для проверки iCal.

- [ ] **Step 7: Финальный checkpoint**

Если все сценарии прошли — Sprint 1 закрыт. Создать чекпоинт через TaskCreate ("Sprint 1 закрыт — все smoke tests passed") и пометить план как выполненный.

Готово к Sprint 2 (engagement features: wishlist attachment, photo wall, reminders, cover gallery UI).

---

## Self-Review

**Spec coverage check:**
- ✅ Event CRUD — Task 5
- ✅ RSVP CRUD — Task 5 (последние эндпоинты)
- ✅ Anon flow — везде через `request.auth.user ?? createUser`
- ✅ PIN-protection — Task 5 (verify + GET с header)
- ✅ iCal export — Task 6
- ✅ SSE realtime — Task 7
- ✅ Cover presets (data) — Task 3
- ✅ Web pages: create, public, host — Tasks 10-12
- ⚠ **Не покрыто в Sprint 1 (intentionally deferred to Sprint 2):** photo wall, cover-gallery UI picker, wishlist attachment UI, reminders worker, dashboard "Мои ивенты" расширение, custom slug
- ⚠ **Не покрыто в Sprint 1 (deferred to Sprint 3):** TG Mini App layout, TG Stars, TG bot extensions

**Placeholder scan:** Все шаги имеют конкретные code-blocks и команды, плейсхолдеров нет.

**Type consistency:**
- `tokenOrSlug` используется в API и client — consistent
- `editToken` flow на API (header `X-Edit-Token`) и client (`eventsApi.update(id, editToken, ...)`) — consistent
- `cancelToken` для анон-гостя в RSVP — consistent (header `X-Cancel-Token`, localStorage `wishly_rsvp_<token>`)
- `rsvpStats` schema — одинаково в `formatPublicEvent` (API) и UI

**Что осталось как риск:**
1. Существующий `apps/web/lib/api-client.ts` — реальные имена `apiFetch` / `API_BASE_URL` могут отличаться. Исполнитель должен прочитать файл и адаптировать (Step 1 в Task 9 это явно делает).
2. Существующий `apps/api/src/routes/sse/index.ts` — реальная структура SSE-роута может отличаться от моего шаблона. Исполнитель должен прочитать и адаптировать (Step 1 в Task 7 это явно делает).
3. Cover-image URLs в seed-data ссылаются на `cdn.wishly.app` — фактический CDN ещё не настроен. UI должен fallback'ить на gray placeholder если image не загружается. В Sprint 2 при работе с cover-gallery UI это решится либо реальной загрузкой обложек в R2, либо переключением на статические assets в `apps/web/public/covers/`.

---

**Конец плана.** Sprint 2 и Sprint 3 — отдельные планы после завершения Sprint 1 (точнее писать когда уже понятен реальный код и поверхности).
