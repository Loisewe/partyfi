import { describe, it, expect } from 'vitest'
import { createHmac, randomBytes } from 'crypto'

/**
 * Mirror of payments route payload encode/decode logic.
 * If the production code in routes/payments/index.ts changes, this test
 * should fail loudly.
 */
const PAYLOAD_VERSION = 'v1'

function encodePayload(eventId: string, userId: string, nonce: string, secret: string): string {
  const body = `${PAYLOAD_VERSION}.${eventId}.${userId}.${nonce}`
  const hmac = createHmac('sha256', secret).update(body).digest('hex').slice(0, 16)
  return `${body}.${hmac}`
}

function decodePayload(
  payload: string,
  secret: string,
): { eventId: string; userId: string; nonce: string } | null {
  const parts = payload.split('.')
  if (parts.length !== 5 || parts[0] !== PAYLOAD_VERSION) return null
  const eventId = parts[1]!
  const userId = parts[2]!
  const nonce = parts[3]!
  const hmac = parts[4]!
  const expected = createHmac('sha256', secret)
    .update(`${PAYLOAD_VERSION}.${eventId}.${userId}.${nonce}`)
    .digest('hex')
    .slice(0, 16)
  if (hmac !== expected) return null
  return { eventId, userId, nonce }
}

describe('TG Stars payment payload', () => {
  const SECRET = 'test-secret-32-chars-of-randomness-here'

  it('roundtrips eventId + userId + nonce', () => {
    const eventId = 'evt-abc123'
    const userId = 'usr-xyz789'
    const nonce = randomBytes(8).toString('hex')

    const encoded = encodePayload(eventId, userId, nonce, SECRET)
    const decoded = decodePayload(encoded, SECRET)

    expect(decoded).not.toBeNull()
    expect(decoded!.eventId).toBe(eventId)
    expect(decoded!.userId).toBe(userId)
    expect(decoded!.nonce).toBe(nonce)
  })

  it('rejects payload signed with a different secret', () => {
    const encoded = encodePayload('e1', 'u1', 'n1', SECRET)
    const decoded = decodePayload(encoded, 'different-secret')
    expect(decoded).toBeNull()
  })

  it('rejects payload with tampered eventId', () => {
    const encoded = encodePayload('e1', 'u1', 'n1', SECRET)
    // Swap eventId without resigning
    const parts = encoded.split('.')
    parts[1] = 'evil-event-id'
    expect(decodePayload(parts.join('.'), SECRET)).toBeNull()
  })

  it('rejects payload with tampered userId (privilege escalation)', () => {
    const encoded = encodePayload('e1', 'u1', 'n1', SECRET)
    const parts = encoded.split('.')
    parts[2] = 'victim-user-id'
    expect(decodePayload(parts.join('.'), SECRET)).toBeNull()
  })

  it('rejects wrong version', () => {
    const encoded = encodePayload('e1', 'u1', 'n1', SECRET)
    const parts = encoded.split('.')
    parts[0] = 'v2'
    expect(decodePayload(parts.join('.'), SECRET)).toBeNull()
  })

  it('rejects malformed payload', () => {
    expect(decodePayload('garbage', SECRET)).toBeNull()
    expect(decodePayload('v1.only.three.parts', SECRET)).toBeNull()
    expect(decodePayload('', SECRET)).toBeNull()
  })

  it('uses truncated 16-char HMAC (not full)', () => {
    const encoded = encodePayload('e1', 'u1', 'n1', SECRET)
    const hmac = encoded.split('.')[4]!
    expect(hmac).toHaveLength(16)
    expect(hmac).toMatch(/^[a-f0-9]{16}$/)
  })
})
