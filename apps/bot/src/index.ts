import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'
import type { Context } from 'grammy'
import type { Wishlist } from '@wishly/shared'
import { formatPrice } from '@wishly/shared'
import { apiGet, apiPost } from './api-client'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!BOT_TOKEN) {
  console.warn('[bot] TELEGRAM_BOT_TOKEN not set — bot disabled.')
  console.warn('[bot] Get a token from @BotFather and set TELEGRAM_BOT_TOKEN in .env to enable.')
  process.exit(0)
}

const WEB_URL = process.env.WEB_URL ?? 'https://partyfi.app'
const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret'

const bot = new Bot(BOT_TOKEN)

// ── /myevents — list user's events ─────────────────────────────────────────

bot.command('myevents', async (ctx) => {
  const tgId = ctx.from?.id
  if (!tgId) return ctx.reply('Не вижу твоего TG ID — попробуй ещё раз')

  try {
    const res = await fetch(`${API_URL}/auth/bot/my-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': BOT_WEBHOOK_SECRET,
      },
      body: JSON.stringify({ telegramId: String(tgId) }),
    })
    if (!res.ok) throw new Error(`api ${res.status}`)
    const data = (await res.json()) as {
      hosted: Array<{ title: string; shareToken: string; startsAt: string }>
      invited: Array<{ title: string; shareToken: string; startsAt: string; hostName: string }>
    }

    if (data.hosted.length === 0 && data.invited.length === 0) {
      await ctx.reply(
        'У тебя пока нет активных ивентов 🍃\n\n' +
          `Создать → ${WEB_URL}/create-event`,
      )
      return
    }

    const fmt = (iso: string) =>
      new Date(iso).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' })

    let text = ''
    if (data.hosted.length > 0) {
      text += '*Хостишь:*\n'
      for (const e of data.hosted) {
        text += `• ${escMd(e.title)} — ${escMd(fmt(e.startsAt))}\n`
      }
      text += '\n'
    }
    if (data.invited.length > 0) {
      text += '*Идёшь к:*\n'
      for (const e of data.invited) {
        text += `• ${escMd(e.title)} \\(от ${escMd(e.hostName)}\\) — ${escMd(fmt(e.startsAt))}\n`
      }
    }

    const keyboard = new InlineKeyboard().webApp('📱 Открыть в Mini App', `${WEB_URL}/dashboard`)
    await ctx.reply(text, { parse_mode: 'MarkdownV2', reply_markup: keyboard })
  } catch (err) {
    console.error('[bot] /myevents failed:', err)
    await ctx.reply('Что-то сломалось, попробуй позже 🙏')
  }
})

// ── /start ─────────────────────────────────────────────────────────────────
// Handles both plain /start and deep links: /start view_SHARETOKEN

bot.command('start', async (ctx) => {
  const payload = ctx.match

  if (payload?.startsWith('view_')) {
    const shareToken = payload.slice(5)
    await showWishlist(ctx, shareToken)
    return
  }

  if (payload?.startsWith('event_')) {
    const shareToken = payload.slice(6)
    await showEvent(ctx, shareToken)
    return
  }

  const keyboard = new InlineKeyboard()
    .webApp('🎁 Открыть Partyfi', `${WEB_URL}`)
    .row()
    .webApp('🎉 Создать ивент', `${WEB_URL}/create-event`)
    .row()
    .text('📋 Мои вишлисты и ивенты', 'my_stuff')

  await ctx.reply(
    `*Привет, ${ctx.from?.first_name ?? 'друг'}!* 👋\n\n` +
      `Partyfi — одна красивая карточка для твоего ивента 🎉\n\n` +
      `*Что внутри:*\n` +
      `• RSVP в один тап с +1\n` +
      `• Прикрепи вишлист — гости забронируют подарок\n` +
      `• Фото-стенка после события\n` +
      `• Напоминания за 24 и 2 часа\n` +
      `• Премиум: кастомный URL, безлимит фото, аналитика\n\n` +
      `Отправь ссылку на ивент или нажми кнопку ниже 👇`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    },
  )
})

// ── Handle wishlist + event URLs pasted into chat ─────────────────────────

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text

  const eventMatch = text.match(/\/e\/([a-z0-9_-]+)/i)
  if (eventMatch?.[1]) {
    await showEvent(ctx, eventMatch[1])
    return
  }

  const wishMatch = text.match(/\/w\/([a-z0-9]+)/i)
  if (wishMatch?.[1]) {
    await showWishlist(ctx, wishMatch[1])
    return
  }
})

// ── /share <token> command (works in any chat including groups) ───────────
// Lets a user post an event card into a TG group. Anyone in the group can
// trigger it — no host-only check because the resulting card is just a
// public preview (whatever /e/{token} would show in a browser).

bot.command('share', async (ctx) => {
  const token = ctx.match?.trim()
  if (!token) {
    await ctx.reply(
      'Использование: `/share <token-или-slug-ивента>`\n\n' +
        'Например: `/share max-bday`',
      { parse_mode: 'Markdown' },
    )
    return
  }
  await showEvent(ctx, token)
})

// ── my_chat_member: bot added to / removed from a group ───────────────────

bot.on('my_chat_member', async (ctx) => {
  const update = ctx.myChatMember
  const newStatus = update.new_chat_member.status
  const oldStatus = update.old_chat_member.status

  const isGroupChat = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup'
  if (!isGroupChat) return

  // Bot was just added (member / admin from left/kicked)
  const wasOut = oldStatus === 'left' || oldStatus === 'kicked'
  const isIn = newStatus === 'member' || newStatus === 'administrator'

  if (wasOut && isIn) {
    try {
      await ctx.reply(
        `👋 *Партифи в группе!*\n\n` +
          `Чтобы вывесить ивент сюда — напишите:\n` +
          `\`/share <token-ивента>\`\n\n` +
          `Token виден в URL: \`partyfi\\.app/e/<token>\`.\n` +
          `Для кастомных URL — тоже подойдёт slug.`,
        { parse_mode: 'MarkdownV2' },
      )
    } catch (err) {
      console.error('[bot] group welcome failed:', err)
    }
  }
})

// ── Callback: my_stuff (dashboard) ─────────────────────────────────────────

bot.callbackQuery('my_stuff', async (ctx) => {
  await ctx.answerCallbackQuery()
  const keyboard = new InlineKeyboard()
    .webApp('📱 Дашборд', `${WEB_URL}/dashboard`)
  await ctx.reply('Открой дашборд — там все твои вишлисты и ивенты:', {
    reply_markup: keyboard,
  })
})

// ── Callback: reserve_ITEMID ───────────────────────────────────────────────

bot.callbackQuery(/^reserve_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery('Для бронирования открой вишлист в приложении')
  // Deep-linking into the web app for reservation is the best UX
  // since it requires name input and mode selection
})

// ── Helper: render event preview ────────────────────────────────────────────

interface EventPreview {
  id: string
  title: string
  description: string | null
  startsAt: string
  location: string | null
  coverImageUrl: string | null
  host: { name: string | null; nickname: string | null }
  wishlist: { name: string; shareToken: string; itemCount: number } | null
  rsvpStats: { going: number; maybe: number; notGoing: number; plusOnesTotal: number }
  requiresPin?: boolean
  preview?: { title: string; hostName: string | null }
}

async function showEvent(ctx: Context, shareToken: string) {
  try {
    const data = await apiGet<EventPreview>(`/events/${shareToken}`)

    // PIN-protected: only show locked preview
    if ('requiresPin' in data && data.requiresPin) {
      const lockedTitle = (data as any).preview?.title ?? 'Закрытый ивент'
      const hostName = (data as any).preview?.hostName ?? 'хоста'
      const keyboard = new InlineKeyboard().webApp(
        '🔒 Открыть и ввести PIN',
        `${WEB_URL}/tg/e/${shareToken}`,
      )
      await ctx.reply(
        `🔒 *${escMd(lockedTitle)}*\n_от ${escMd(hostName)}_\n\nЭтот ивент защищён PIN\\. Открой Mini App и введи код от хоста\\.`,
        { parse_mode: 'MarkdownV2', reply_markup: keyboard },
      )
      return
    }

    const event = data
    const hostName = event.host.name ?? event.host.nickname ?? 'Аноним'
    const when = new Date(event.startsAt).toLocaleString('ru-RU', {
      dateStyle: 'long',
      timeStyle: 'short',
    })

    let text = `🎉 *${escMd(event.title)}*\n`
    text += `_от ${escMd(hostName)}_\n\n`
    text += `🗓 ${escMd(when)}\n`
    if (event.location) text += `📍 ${escMd(event.location)}\n`

    if (event.description) {
      const desc = event.description.length > 200
        ? event.description.slice(0, 200) + '…'
        : event.description
      text += `\n${escMd(desc)}\n`
    }

    text += `\n👥 Идут: *${event.rsvpStats.going}* · Может: *${event.rsvpStats.maybe}*`
    if (event.rsvpStats.plusOnesTotal > 0) {
      text += ` · \\+${event.rsvpStats.plusOnesTotal}`
    }

    if (event.wishlist) {
      text += `\n\n🎁 Вишлист хоста: *${escMd(event.wishlist.name)}* \\(${event.wishlist.itemCount} ${itemsWord(event.wishlist.itemCount)}\\)`
    }

    const keyboard = new InlineKeyboard()
      .webApp('🎉 Открыть и подтвердить', `${WEB_URL}/tg/e/${shareToken}`)

    if (event.wishlist) {
      keyboard.row().webApp(
        '🎁 Посмотреть вишлист',
        `${WEB_URL}/w/${event.wishlist.shareToken}`,
      )
    }

    await ctx.reply(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard,
    })
  } catch {
    await ctx.reply(
      '😕 Не могу найти этот ивент. Возможно, он был отменён или ссылка неверная.',
    )
  }
}

// ── Helper: render wishlist preview ────────────────────────────────────────

async function showWishlist(ctx: Context, shareToken: string) {
  try {
    const wishlist = await apiGet<Wishlist & { isOwner: boolean }>(
      `/wishlists/${shareToken}`,
    )

    const ownerName =
      wishlist.user.name ?? wishlist.user.nickname ?? 'Аноним'
    const itemCount = wishlist.itemCount
    const items = wishlist.items?.slice(0, 5) ?? []

    // Build text
    let text = `🎁 *${escMd(wishlist.name)}*\n`
    text += `_Вишлист ${escMd(ownerName)}_\n`
    if (wishlist.description) {
      text += `\n${escMd(wishlist.description)}\n`
    }
    text += `\n*${itemCount} ${itemsWord(itemCount)}:*\n`

    for (const item of items) {
      const isReserved = item.reservation?.status === 'ACTIVE'
      const priceStr =
        item.price != null && item.currency
          ? ` — ${formatPrice(item.price, item.currency)}`
          : ''
      const reservedStr = isReserved ? ' ✅' : ''
      text += `• ${escMd(item.name)}${escMd(priceStr)}${reservedStr}\n`
    }

    if (itemCount > 5) {
      text += `_...и ещё ${itemCount - 5}_\n`
    }

    // Keyboard
    const keyboard = new InlineKeyboard().webApp(
      '🛍 Открыть вишлист',
      `${WEB_URL}/w/${shareToken}`,
    )

    await ctx.reply(text, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard,
    })
  } catch {
    await ctx.reply(
      '😕 Не могу найти этот вишлист. Возможно, он был удалён или ссылка неверная.',
    )
  }
}

// ── Inline mode: search wishlists to share ─────────────────────────────────
// When someone types @PartyfiBot in any chat, they can share their wishlist

bot.on('inline_query', async (ctx) => {
  const shareUrl = `${WEB_URL}`
  await ctx.answerInlineQuery(
    [
      {
        type: 'article',
        id: 'open_app',
        title: '🎁 Поделиться вишлистом',
        description: 'Открой Partyfi и выбери вишлист для отправки',
        input_message_content: {
          message_text: `Загляни в мой вишлист на Partyfi: ${shareUrl}`,
        },
        reply_markup: new InlineKeyboard().url('Открыть Partyfi', shareUrl),
      },
      {
        type: 'article',
        id: 'create_event',
        title: '🎉 Создать ивент',
        description: 'Партифул-стайл приглашения с RSVP в Telegram',
        input_message_content: {
          message_text: `Собираюсь устроить тусовку — создай ивент на Partyfi: ${shareUrl}/create-event`,
        },
        reply_markup: new InlineKeyboard().webApp(
          'Создать ивент',
          `${shareUrl}/create-event`,
        ),
      },
    ],
    { cache_time: 0 },
  )
})

// ── Payments: TG Stars ──────────────────────────────────────────────────────
// Spec: https://core.telegram.org/bots/payments-stars

// Pre-checkout: must answer within 10s. Always say OK; verification happens
// when invoice was created by our API, where payload was already HMAC-signed.
bot.on('pre_checkout_query', async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true)
  } catch (err) {
    console.error('pre_checkout_query answer failed:', err)
  }
})

// Successful payment: confirm with API to create EventUpgrade
bot.on(':successful_payment', async (ctx) => {
  const payment = ctx.message?.successful_payment
  if (!payment) return

  const webhookSecret = process.env.BOT_WEBHOOK_SECRET ?? process.env.JWT_SECRET
  if (!webhookSecret) {
    console.error('BOT_WEBHOOK_SECRET / JWT_SECRET not set — cannot confirm payment')
    return
  }

  try {
    await apiPost(
      '/payments/tg-stars/confirm',
      {
        payload: payment.invoice_payload,
        tgPaymentChargeId: payment.telegram_payment_charge_id,
        starAmount: payment.total_amount,
        telegramUserId: String(ctx.from?.id ?? ''),
      },
      undefined,
      { 'x-bot-secret': webhookSecret },
    )
    await ctx.reply(
      `✅ Спасибо! Твой ивент теперь *премиум*\\.\n\n` +
        `Что разблокировано:\n` +
        `• Кастомный URL\n` +
        `• Безлимит фото\n` +
        `• Аналитика просмотров и RSVP`,
      { parse_mode: 'MarkdownV2' },
    )
  } catch (err) {
    console.error('Payment confirm failed:', err)
    await ctx.reply(
      `❌ Платёж получен, но возникла ошибка при активации премиум\\.\n` +
        `Напиши нам — ${escMd(payment.telegram_payment_charge_id)}`,
      { parse_mode: 'MarkdownV2' },
    )
  }
})

// ── Error handling ─────────────────────────────────────────────────────────

bot.catch((err) => {
  console.error('Bot error:', err)
})

// ── Start ──────────────────────────────────────────────────────────────────

bot.start({
  onStart: (info) => console.log(`@${info.username} bot is running`),
})

// ── Helpers ────────────────────────────────────────────────────────────────

function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

function itemsWord(n: number): string {
  const m = n % 10
  const m100 = n % 100
  if (m === 1 && m100 !== 11) return 'желание'
  if (m >= 2 && m <= 4 && (m100 < 10 || m100 >= 20)) return 'желания'
  return 'желаний'
}
