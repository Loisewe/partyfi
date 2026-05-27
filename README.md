# Wishly 🎁

> Вишлисты, которыми удобно делиться

Создай список желаний за 30 секунд — без регистрации. Добавляй товары по ссылке (мы сами подтянем цену и картинку), делись с друзьями, организуй совместные подарки.

---

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Fastify 4 + Node.js |
| ORM | Prisma 5 |
| БД | PostgreSQL 16 |
| Кеш / Очередь | Redis 7 + BullMQ |
| Хранилище | Cloudflare R2 |
| Платежи | Stripe + YooKassa |
| Монорепо | Turborepo + pnpm |

---

## Структура

```
wishlist/
├── apps/
│   ├── web/          # Next.js фронтенд
│   ├── api/          # Fastify API
│   └── bot/          # Telegram Bot (Phase 4)
└── packages/
    ├── shared/       # Типы, схемы Zod, утилиты
    └── db/           # Prisma клиент
```

---

## Быстрый старт (локально)

### 1. Требования

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 2. Клонирование и установка зависимостей

```bash
git clone https://github.com/your-org/wishly.git
cd wishly
pnpm install
```

### 3. Переменные окружения

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

### 4. Запуск PostgreSQL и Redis

```bash
docker-compose up -d
```

### 5. Миграции БД

```bash
pnpm db:migrate
```

### 6. Запуск в dev-режиме

```bash
pnpm dev
```

- Фронтенд: http://localhost:3000
- API: http://localhost:3001
- API Docs (Swagger): http://localhost:3001/docs

---

## Этапы разработки

- **Phase 1** ✅ MVP — вишлисты, добавление по ссылке, публичный просмотр
- **Phase 2** — Бронирование подарков, совместные подарки, OAuth
- **Phase 3** — Платежи (Stripe + YooKassa)
- **Phase 4** — Telegram Bot + Mini App

---

## API

Полная документация Swagger доступна по адресу `/docs` при запущенном API.

Ключевые эндпоинты:

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/v1/wishlists` | Создать вишлист |
| `GET` | `/api/v1/wishlists/:shareToken` | Просмотр вишлиста |
| `GET` | `/api/v1/wishlists/:editToken/edit` | Режим редактирования |
| `POST` | `/api/v1/wishlists/:id/items` | Добавить товар |
| `POST` | `/api/v1/scrape` | Получить данные по URL |
| `POST` | `/api/v1/items/:id/reserve` | Забронировать подарок |
| `DELETE` | `/api/v1/reservations/:id` | Отменить бронь |
