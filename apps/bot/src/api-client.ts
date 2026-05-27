// Typed API client for the Event Gallery backend — shared between web and bot.
// The bot calls the same REST API, using the Telegram user's JWT.

const API_BASE = process.env.API_URL ?? 'http://localhost:3001/api/v1'

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${path} — ${errText}`)
  }
  return res.json() as Promise<T>
}
