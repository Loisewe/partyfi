# Wishly Events — Design Spec

**Дата:** 2026-05-27
**Статус:** Approved — ready for implementation planning
**Автор решений:** brainstorming dialogue с product owner (history: `Personal/Projs/autonomus project/`)

---

## 1. Контекст и цель

### 1.1 Что мы строим

Расширение существующей монорепы `wishly` функционалом ивентов в стиле Partiful, обёрнутое в Telegram Mini App. Ключевая отличительная черта — нативная связка между ивентом и вишлистом хоста (никто из конкурентов так не делает в RU-сегменте).

### 1.2 Целевая аудитория

Русскоязычные пользователи (RU + диаспора), организующие неформальные мероприятия (дни рождения, новоселья, посиделки, девичники, бэби-шауэры). Большинство уже сидит в Telegram-чатах с друзьями.

### 1.3 Бизнес-цель v1

Первые **$10-100 реальной выручки** через Telegram Stars в течение первого месяца после релиза.

### 1.4 Что НЕ строим (явные non-goals)

- Group gifting / совместные подарки (схема `Kitty/Payment` существует в wishly, но **замораживается** до v2 — слишком сложная custody-модель)
- AI-генерация обложек (v2)
- Multi-host права (только одиночный хост)
- Recurring events (YAGNI)
- Видео в photo wall (только фото v1)
- Comment threads на странице ивента (TG-чат заменяет)
- Подписка (только per-event покупки в v1)
- Multi-language (только русский v1, английский — v2)
- Native push notifications (только TG push)

---

## 2. User stories

### 2.1 Хост (организатор)

- Как хост, я хочу за минуту создать страницу события (название, дата, место, обложка), чтобы быстро кинуть ссылку в чат друзей
- Как хост, я хочу прикрепить свой существующий вишлист к ивенту, чтобы гости видели "что подарить" вместе с RSVP
- Как хост, я хочу видеть список тех кто идёт / может быть / не идёт с автообновлением
- Как хост, я хочу написать апдейт ("дождь — переезжаем ко мне") и автоматически разослать всем RSVP'd гостям через TG
- Как хост, я хочу удалить нерелевантные фото из photo wall
- Как хост, я хочу купить премиум-апгрейд для конкретного ивента (кастомный URL, своя обложка, аналитика) за 100 TG Stars

### 2.2 Гость

- Как гость, я хочу открыть ссылку приглашения (из TG/WhatsApp/iMessage) и за один тап ответить "иду / может быть / не иду"
- Как гость, я не хочу регистрироваться чтобы RSVP-нуть (анонимный поток обязателен)
- Как гость, я хочу увидеть кто ещё идёт (для social proof / FOMO)
- Как гость, я хочу указать +1, +2 (без имён друзей)
- Как гость, я хочу забронировать подарок из прикреплённого вишлиста хоста (сюрприз остаётся сюрпризом)
- Как гость, я хочу получить напоминание в TG за 24 часа и за 2 часа
- Как гость, я хочу залить фото в photo wall после события
- Как гость, я хочу экспортировать ивент в свой календарь (.ics)

### 2.3 Анонимный поток

Reuse существующий wishly-паттерн: ephemeral User с автогенерированным никнеймом, `editToken` для возврата к своим действиям, без email и без OAuth.

---

## 3. Scope decisions matrix

| # | Решение | Что выбрано |
|---|---------|-------------|
| 1 | Multi-host | Single host v1, без co-host прав |
| 2 | Group gifting | Заморожено (схема Kitty остаётся, эндпоинты не добавляем) |
| 3 | Privacy model | Public link + опциональный 4-значный PIN |
| 4 | Wishlist attachment | Опционально, prominent CTA при создании, можно прикрепить позже |
| 5 | Видимость RSVP | По умолчанию все гости видят друг друга, хост может переключить на host-only |
| 6 | Plus-ones | Только count (+1, +2), без имён |
| 7 | Photo wall | Да, auto-show, гости загружают, хост может удалить |
| 8 | Comments | Нет — кнопка "обсудить в TG" deeplink на хост-аккаунт |
| 9 | Reminders | T-24h и T-2h через TG-бота, хост может выключить |
| 10 | Recurring events | Нет |
| 11 | Templates | Одна форма + 20-30 пресет-обложек, теги по occasion |
| 12 | Capacity limit | Без лимита, не платная стена |
| 13 | Cancel/postpone | Да, edit события → auto-push всем RSVP'd через бота |
| 14 | RSVP states | `GOING` / `MAYBE` / `NOT_GOING` (pending = отсутствие записи) |
| 15 | Anon RSVP | Да, reuse wishly anon-паттерн с nickname-генератором |
| 16 | Cover image | Preset gallery (20-30 обложек) + custom upload (премиум) |
| 17 | URL slug | Random в free (`/e/abc123xy`), кастомный slug в премиум (`/e/anyas-bday`) |
| 18 | iCal export | Да, free, generate `.ics` на странице ивента |
| 19 | Web fallback | Web всегда работает + prominent "Открыть в Telegram" CTA |
| 20 | Премиум-модель | Per-event 100 XTR (~$1.30), одна цена |

---

## 4. Премиум-модель

### 4.1 Free tier (все)

- Безлимит ивентов
- Безлимит гостей
- Прикрепление вишлиста
- Photo wall (до 50 фото на ивент)
- Preset обложки (20-30 шт.)
- Базовые reminders (T-24h, T-2h)
- iCal экспорт
- Public link sharing
- Анонимные хосты и гости

### 4.2 Premium per-event (100 XTR ≈ $1.30, one-time)

- **Кастомный URL slug** (`/e/anyas-bday` вместо рандома)
- **Кастомная обложка** (свой upload вместо preset)
- **Безлимит photo wall**
- **Аналитика** — кто открыл инвайт, кто RSVP-нул в каком порядке, peak time RSVP
- **Доп. reminders** — настраиваемые слоты (T-1 week, custom datetime)
- **Убрать "Made with Wishly" футер**

### 4.3 Расчёт цели

$10-100 = 8-80 покупок. При реалистичной conversion 1-3% от хостов, нужно 300-8000 ивентов в первый месяц. Учитывая виральность (каждый ивент — это invite link для 15-30 гостей) и solidarity-purchases от знакомых — **достижимо**.

---

## 5. Архитектура

### 5.1 TG Mini App стратегия

**Approach C — один Next.js + TG-aware layouts через route groups.**

```
apps/web/
├── app/
│   ├── (tg)/              # layout с TG WebApp SDK, MainButton навигация
│   │   ├── e/[token]/
│   │   ├── e/[token]/host/
│   │   ├── e/[token]/photos/
│   │   └── create/
│   ├── (web)/             # layout с обычной web-навигацией
│   │   ├── e/[token]/
│   │   ├── e/[token]/photos/
│   │   └── create/
│   ├── middleware.ts      # детектит TG initData → редирект в (tg)
│   └── ...
```

Детектор TG:
- В middleware читаем header `X-Telegram-Init-Data` (если бот открыл miniapp)
- На клиенте — `window.Telegram?.WebApp` для гидратации
- Fallback на (web) если ни того, ни другого

### 5.2 Авторизация

Три потока:

1. **Авторизованный TG юзер (Mini App)** — initData валидируется на API через HMAC с bot token, создаётся или мерджится User с `telegramId`, выдаётся JWT
2. **Авторизованный web юзер (Google OAuth)** — существующий NextAuth flow без изменений
3. **Анонимный юзер (web fallback или браузер)** — reuse существующий wishly anon-паттерн: ephemeral User с nickname + editToken

Мердж: если анон позже логинится через TG или Google — merge anon User в auth User (его ивенты, RSVP, фото переезжают). Этот merge паттерн уже есть в wishly (`User.signin merge`).

### 5.3 Платежи через TG Stars

**Не используем существующую Kitty/Payment схему** — она для group-gifting (заморожена). Добавляем отдельную абстракцию для одноразовых покупок:

```prisma
model EventUpgrade {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  eventId         String   @unique
  event           Event    @relation(fields: [eventId], references: [id])
  purchaserUserId String
  starsAmount     Int      // в XTR
  tgPaymentChargeId String  @unique
  features        Json     // { customSlug: true, customCover: true, ... }
}
```

Flow:
1. Хост на странице ивента жмёт "Сделать премиум"
2. Бот через `sendInvoice` (currency=`XTR`) запрашивает 100 Stars
3. Юзер платит → `pre_checkout_query` validate → `successful_payment` → создаём `EventUpgrade`
4. Event.isPremium = true (computed через relation)

---

## 6. Data model — Prisma additions

```prisma
model Event {
  id              String      @id @default(cuid())
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  // Ownership
  hostUserId      String
  host            User        @relation("EventHost", fields: [hostUserId], references: [id])
  editToken       String      @unique  // для anon-хостов

  // Content
  title           String
  description     String?
  startsAt        DateTime
  endsAt          DateTime?
  location        String?      // free-form text (адрес/название/zoom-ссылка)
  locationLink    String?      // опциональный maps URL

  // Cover
  coverPresetId   String?      // ссылка на preset из шаблонов
  coverImageUrl   String?      // если custom upload (только премиум)

  // Sharing
  shareToken      String      @unique  // /e/abc123xy
  customSlug      String?     @unique  // /e/anyas-bday (премиум)
  pinHash         String?     // bcrypt-хеш 4-значного PIN, если установлен

  // Settings
  rsvpVisibility  RsvpVisibility @default(ALL_GUESTS)  // ALL_GUESTS | HOST_ONLY
  remindersEnabled Boolean    @default(true)

  // Wishlist link
  wishlistId      String?
  wishlist        Wishlist?   @relation(fields: [wishlistId], references: [id])

  // Status
  status          EventStatus @default(ACTIVE)  // ACTIVE | CANCELLED | ARCHIVED
  cancelMessage   String?     // если CANCELLED — сообщение для гостей

  // Premium
  upgrade         EventUpgrade?

  // Relations
  rsvps           EventRsvp[]
  photos          EventPhoto[]
  reminders       EventReminder[]

  @@index([hostUserId])
  @@index([startsAt])
}

model EventRsvp {
  id              String      @id @default(cuid())
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  eventId         String
  event           Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  guestUserId     String
  guest           User        @relation("GuestRsvps", fields: [guestUserId], references: [id])

  status          RsvpStatus  // GOING | MAYBE | NOT_GOING
  plusOnes        Int         @default(0)  // 0, 1, 2, ...
  message         String?     // опциональный комментарий хосту
  cancelTokenHash String?     // для anon-гостя чтобы изменить ответ

  @@unique([eventId, guestUserId])
  @@index([eventId, status])
}

model EventPhoto {
  id              String      @id @default(cuid())
  createdAt       DateTime    @default(now())

  eventId         String
  event           Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  uploaderUserId  String
  uploader        User        @relation("PhotoUploads", fields: [uploaderUserId], references: [id])

  r2Key           String      // ключ в Cloudflare R2
  width           Int
  height          Int
  sizeBytes       Int

  @@index([eventId, createdAt])
}

model EventReminder {
  id              String      @id @default(cuid())
  eventId         String
  event           Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  triggerAt       DateTime
  kind            ReminderKind  // T_24H | T_2H | CUSTOM
  sentAt          DateTime?

  @@index([triggerAt, sentAt])
}

model EventUpgrade {
  id                 String   @id @default(cuid())
  createdAt          DateTime @default(now())
  eventId            String   @unique
  event              Event    @relation(fields: [eventId], references: [id])
  purchaserUserId    String
  starsAmount        Int
  tgPaymentChargeId  String   @unique
  features           Json     // { customSlug, customCover, analytics, removeFooter, extraReminders }
}

model EventCoverPreset {
  id              String   @id @default(cuid())
  slug            String   @unique  // "birthday-balloons", "housewarming-keys", etc.
  imageUrl        String
  occasionTags    String[] // ["birthday", "casual"]
  displayOrder    Int      @default(0)
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

### 6.1 User-модель расширение

Добавляем в существующий `User`:
- `telegramId String? @unique` (для TG auth)
- `telegramUsername String?` (для отображения)

Обратные relations:
- `hostedEvents Event[] @relation("EventHost")`
- `guestRsvps EventRsvp[] @relation("GuestRsvps")`
- `photoUploads EventPhoto[] @relation("PhotoUploads")`

### 6.2 ВАЖНО: первая миграция

Существующая wishly-schema **никогда не мигрировалась** (только `prisma db push`). При добавлении Event-моделей создаём **первую миграцию через `prisma migrate dev --name init_events`**, которая включает baseline существующей schema + новые таблицы. Это закрывает риск из аудита.

---

## 7. API endpoints

Все под `/api/v1/`. JWT auth через existing wishly-middleware, anon flow через `x-edit-token` header или body-token.

### 7.1 Events

| Method | Path | Описание |
|--------|------|----------|
| POST | `/events` | Создать ивент (auth или anon) |
| GET | `/events/:tokenOrSlug` | Получить ивент по shareToken или customSlug |
| PATCH | `/events/:id` | Обновить (host only via JWT или editToken) |
| DELETE | `/events/:id` | Отменить (мягко — `status=CANCELLED`) |
| GET | `/events/mine` | Мои ивенты (host + где RSVP-нул) |
| POST | `/events/:id/verify-pin` | Проверить PIN если ивент защищён |

### 7.2 RSVP

| Method | Path | Описание |
|--------|------|----------|
| POST | `/events/:id/rsvp` | Создать или обновить свой RSVP (status + plusOnes + message) |
| DELETE | `/events/:id/rsvp` | Удалить свой RSVP |
| GET | `/events/:id/guests` | Список гостей (зависит от rsvpVisibility) |

### 7.3 Photos

| Method | Path | Описание |
|--------|------|----------|
| POST | `/events/:id/photos/presigned` | Получить presigned URL для прямого upload в R2 |
| POST | `/events/:id/photos/confirm` | Подтвердить успешный upload (записать в DB) |
| DELETE | `/events/:id/photos/:photoId` | Удалить (host only или uploader) |
| GET | `/events/:id/photos` | Список фото с paginated URLs |

### 7.4 Premium

| Method | Path | Описание |
|--------|------|----------|
| POST | `/events/:id/upgrade/invoice` | Создать TG Stars invoice link (бот шлёт юзеру) |
| POST | `/webhooks/tg/payment` | TG callback: `successful_payment` — записать EventUpgrade |

### 7.5 iCal

| Method | Path | Описание |
|--------|------|----------|
| GET | `/events/:id/ical` | Сгенерировать `.ics` (text/calendar) |

### 7.6 SSE (real-time)

Reuse существующий wishly-механизм SSE через Redis pub/sub:
- Канал: `event:{eventId}` — для live-обновлений RSVP и photo upload
- Подписка с web/miniapp страницы ивента

---

## 8. Telegram Bot extensions

Существующий `apps/bot/src/index.ts`:
- `/start <token>` — открыть ивент по deep-link
- `/start create` — открыть форму создания
- `/my_events` — список моих ивентов

Mini App entry point:
- `bot.command('events', ctx => ctx.reply('Открыть Wishly', { reply_markup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: 'https://wishly.app/events' } }]] } }))`

Payment handlers:
- `bot.on('pre_checkout_query', ...)` — validate invoice payload
- `bot.on('successful_payment', ...)` — записать `EventUpgrade`, обновить Event

Reminders worker:
- Cron-job (BullMQ — уже в стеке wishly) опрашивает `EventReminder` где `triggerAt <= now() AND sentAt IS NULL`
- Для каждого: отправить TG-message всем гостям с `RsvpStatus=GOING` у кого есть `telegramId`
- Mark `sentAt = now()`

---

## 9. Photo wall

### 9.1 Upload flow

Direct-to-R2 через presigned URLs (исключаем proxy через API):

1. Клиент: `POST /events/:id/photos/presigned` → получает signed URL + `r2Key`
2. Клиент: `PUT` файл прямо в R2 через signed URL
3. Клиент: `POST /events/:id/photos/confirm` с `r2Key` + dimensions
4. Сервер: записывает `EventPhoto` + publish в SSE канал
5. Все подписанные клиенты получают live-обновление

### 9.2 Storage policy

- Лимит free: 50 фото / ивент. При превышении — UI блок "перейти на премиум"
- Лимит premium: 500 фото / ивент (защита от abuse)
- Размер: max 10MB/файл, форматы JPEG/WebP/PNG
- TTL: фото живут 365 дней с даты ивента, потом auto-archive (R2 lifecycle rule)

### 9.3 Модерация

- Хост может удалять любые фото в своём ивенте
- Гость-загрузчик может удалить только свои собственные загрузки
- Кнопка "пожаловаться" в v2 (YAGNI)

---

## 10. UI поверхности

### 10.1 Web app (`/apps/web` под `(web)` layout)

- `/` — лендинг (существующий)
- `/dashboard` — мои ивенты + вишлисты (существующий dashboard расширяем)
- `/create-event` — форма создания ивента
- `/e/[tokenOrSlug]` — публичная страница ивента (RSVP form, гости, wishlist preview, photo wall)
- `/e/[tokenOrSlug]/host` — host-режим (управление, апдейты, аналитика)
- `/e/[tokenOrSlug]/photos` — full-screen photo wall

### 10.2 TG Mini App (`/apps/web` под `(tg)` layout)

Те же страницы, но:
- Шапка скрыта (TG header)
- Навигация через TG `MainButton` (например: на странице создания — `MainButton = "Создать ивент"`)
- BackButton интегрирован
- Тема (light/dark) синхронизирована с TG через `themeParams`
- Шаринг через TG `switchInlineQuery` вместо copy-link

### 10.3 Бот

- Минимальный текстовый UI: показ ссылок и кнопок-открытий Mini App
- Все интерактивные действия — внутри Mini App, не в бот-командах (для UX-консистентности)

---

## 11. Реferral / sharing mechanics

Каждый раз когда хост шарит ссылку на ивент — встроенная виральность:
- Ссылка работает везде (TG, WhatsApp, iMessage, веб)
- В TG открывается в Mini App (через `https://t.me/wishly_bot/app?startapp=event_<token>`)
- Анонимный гость может ответить за 2 клика без регистрации
- После RSVP — soft prompt "поделись с друзьями" с pre-filled message

Никаких реферал-бонусов в v1 (YAGNI).

---

## 12. Notifications

**Только TG push** — никаких email, никаких native push в v1.

| Триггер | Кому | Сообщение |
|---------|------|-----------|
| Новый RSVP | Хосту (если `telegramId`) | "@vasya ответил GOING на 'День рождения Ани' (+1)" |
| Изменение ивента (location/date) | Всем GOING + MAYBE | "Хост обновил 'День рождения Ани': новое место — ..." |
| Отмена ивента | Всем GOING + MAYBE | "Хост отменил 'День рождения Ани'. Причина: ..." |
| Reminder T-24h | Всем GOING | "Завтра в 19:00 — 'День рождения Ани' (адрес...)" |
| Reminder T-2h | Всем GOING | "Через 2 часа — 'День рождения Ани'" |
| Successful payment | Покупателю | "Премиум активирован для 'День рождения Ани'" |

---

## 13. Аналитика (для премиум-хостов)

- Кто открыл инвайт (counter unique views по `shareToken`)
- Когда RSVP-нул каждый гость (timeline graph)
- Peak time RSVP (когда массово отвечают)
- Conversion rate: views → RSVP

Implementation:
- Tracking: middleware на `/e/:tokenOrSlug` пишет событие в Postgres (отдельная таблица `EventView`)
- Никакого PostHog/GA в v1 — собственная мини-аналитика
- Доступ только покупателю премиума

---

## 14. Риски и митигации

| Риск | Митигация |
|------|-----------|
| TG initData валидация: HMAC-проверка может быть закосячена → security hole | Использовать `@telegram-apps/init-data-node` (официальный SDK), не вручную |
| TG Stars API относительно новый, мало примеров | Reference: official Telegram Stars docs + boilerplate `tg-stars-bot-example` на GitHub |
| R2 presigned URLs: misconfigured CORS = upload не работает в браузере | Тест на dev-env прежде чем релизить, CORS-config в R2 dashboard |
| Spam photo uploads → cost overruns | Rate limit 5 фото / минуту с одного User, max size enforced |
| Anon RSVP без верификации = фейковые гости | YAGNI в v1, мониторим. При abuse — добавить TG required |
| Schema migration baseline на проде → коллизия с реальной DB | На production первым делом `prisma migrate resolve --applied <baseline>` если БД уже накатана через push |
| TG Stars monetization порог: TG требует ~$50 минимум для вывода | Учитываем в финансовом плане, не блокирует прод |
| Виральность ≠ guaranteed — может не пойти | Готовый план seed-distribution: запуск в RU-чатах про вечеринки/мероприятия, Habr-пост о техническом устройстве |

---

## 15. Success metrics (как поймём что зашло)

**Минимально (необходимый сигнал жизни):**
- 50+ созданных ивентов в первый месяц
- 200+ RSVP
- 5+ premium-покупок ($6.50+ revenue)

**Хорошо:**
- 200+ ивентов / месяц
- 1000+ RSVP
- 30+ premium-покупок ($40+ revenue) **— цель**
- Хотя бы 1 ивент с 30+ гостями

**Виральный хит:**
- 500+ ивентов / месяц
- 80+ premium-покупок ($100+ revenue) **— stretch goal**
- Органический mention в RU-tech-Telegram-каналах

---

## 16. Что переиспользуем из существующего wishly

| Компонент | Использование |
|-----------|---------------|
| Prisma client (`packages/db`) | Добавляем модели, расширяем User |
| Shared types/zod (`packages/shared`) | Добавляем event-схемы |
| API auth middleware | JWT + editToken — переиспользуем для events |
| Anonymous user pattern | Та же логика для anon-хостов и anon-гостей |
| SSE infrastructure (Redis pub/sub) | Reuse для live RSVP / photo updates |
| Cloudflare R2 client | Reuse для photo storage |
| Telegram bot framework | Расширяем существующий `apps/bot` (grammy/telegraf — какой уже стоит) |
| Wishlist CRUD | Reuse для прикрепления к ивенту |
| Item reservation | Reuse для бронирования подарков из event-context |
| Web app shell (NextAuth, Tailwind, существующие компоненты) | Расширяем |

---

## 17. План спринтов (high-level — детали в writing-plans)

### Sprint 1 (5-7 дней): Foundation
- Prisma migration baseline + новые модели
- API: event CRUD, RSVP endpoints, anon flow
- Web UI: страница создания, публичная страница ивента, RSVP-форма
- Базовый web layout без TG-обёртки

### Sprint 2 (7-10 дней): Engagement features
- Wishlist attachment (UI + API)
- Photo wall (R2 presigned + UI grid + SSE updates)
- Cover preset gallery + первые 20-30 обложек
- Reminders system (BullMQ worker + TG bot send)
- iCal export

### Sprint 3 (5-7 дней): TG Mini App + Monetization
- `(tg)` route group + TG WebApp SDK интеграция
- TG initData auth flow
- Bot: deep-links для ивентов, Mini App entry points
- TG Stars payment flow + EventUpgrade
- Custom slug, custom cover, аналитика — премиум-фичи
- Cancel/postpone push notifications
- Полировка, smoke tests, deploy

---

## 18. Открытые вопросы (на потом, не блокеры)

- Какой именно provider deploy для bot worker — Railway / Fly / Render? Решаем при настройке CI/CD
- Какой именно TG bot username берём? Спросить хоста при первом деплое
- Domain — `wishly.app` или другой? Спросить при настройке prod
- Аналитика: хватит ли собственной мини-аналитики или нужен PostHog/Plausible для product-discovery? Решаем после первого месяца

---

**Конец spec.** Следующий шаг: invoke `writing-plans` для разбиения на executable steps.
