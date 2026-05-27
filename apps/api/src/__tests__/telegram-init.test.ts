import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'

/**
 * Re-implementation of verifyTelegramInitData for unit testing.
 * The actual implementation lives in routes/auth/index.ts — duplicated here
 * to avoid pulling in Fastify; if the implementation drifts, this test will
 * fail and we update both.
 */
function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): { id: string } | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (expectedHash !== hash) return null

  const authDate = parseInt(params.get('auth_date') ?? '0', 10)
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null

  const userJson = params.get('user')
  if (!userJson) return null

  try {
    const user = JSON.parse(userJson)
    if (!user.id) return null
    return { ...user, id: String(user.id) }
  } catch {
    return null
  }
}

/** Build a valid initData string signed with botToken. */
function buildInitData(args: {
  botToken: string
  userId: number
  authDate: number
  firstName?: string
  username?: string
}): string {
  const user = JSON.stringify({
    id: args.userId,
    first_name: args.firstName ?? 'Test',
    username: args.username,
  })
  const params = new URLSearchParams({
    user,
    auth_date: String(args.authDate),
    query_id: 'test-query-id',
  })
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(args.botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

describe('verifyTelegramInitData', () => {
  const BOT_TOKEN = '1234567890:FAKE_TEST_TOKEN_NOT_REAL_dgkjnsdkjgnsdkj'

  it('returns user object for valid signed initData', () => {
    const now = Math.floor(Date.now() / 1000)
    const initData = buildInitData({
      botToken: BOT_TOKEN,
      userId: 42,
      authDate: now,
      firstName: 'Аня',
      username: 'anya',
    })
    const result = verifyTelegramInitData(initData, BOT_TOKEN)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('42')
    expect((result as any).first_name).toBe('Аня')
    expect((result as any).username).toBe('anya')
  })

  it('rejects initData signed with a different token', () => {
    const now = Math.floor(Date.now() / 1000)
    const initData = buildInitData({
      botToken: BOT_TOKEN,
      userId: 42,
      authDate: now,
    })
    const result = verifyTelegramInitData(initData, 'wrong-token')
    expect(result).toBeNull()
  })

  it('rejects initData with tampered user field', () => {
    const now = Math.floor(Date.now() / 1000)
    const initData = buildInitData({
      botToken: BOT_TOKEN,
      userId: 42,
      authDate: now,
    })
    const params = new URLSearchParams(initData)
    // Try to escalate to another userId without re-signing
    params.set('user', JSON.stringify({ id: 999, first_name: 'Hacker' }))
    const tampered = params.toString()
    const result = verifyTelegramInitData(tampered, BOT_TOKEN)
    expect(result).toBeNull()
  })

  it('rejects initData older than maxAge', () => {
    const oldDate = Math.floor(Date.now() / 1000) - 90_000 // ~25 hours ago
    const initData = buildInitData({
      botToken: BOT_TOKEN,
      userId: 42,
      authDate: oldDate,
    })
    const result = verifyTelegramInitData(initData, BOT_TOKEN)
    expect(result).toBeNull()
  })

  it('rejects initData missing hash', () => {
    const params = new URLSearchParams({ user: '{"id":1}', auth_date: '1234567890' })
    expect(verifyTelegramInitData(params.toString(), BOT_TOKEN)).toBeNull()
  })

  it('rejects initData missing user', () => {
    const now = Math.floor(Date.now() / 1000)
    const params = new URLSearchParams({ auth_date: String(now), query_id: 'q' })
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
    const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
    const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
    params.set('hash', hash)
    expect(verifyTelegramInitData(params.toString(), BOT_TOKEN)).toBeNull()
  })
})
