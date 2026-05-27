// Price utilities: prices stored as minor units (cents/kopecks)
// $49.99 → 4999; ₽1490 → 149000

const CURRENCY_MINOR_UNITS: Record<string, number> = {
  USD: 100,
  EUR: 100,
  GBP: 100,
  RUB: 100,
  JPY: 1,   // no minor units
  KRW: 1,
}

export function toMinorUnits(amount: number, currency: string): number {
  const multiplier = CURRENCY_MINOR_UNITS[currency.toUpperCase()] ?? 100
  return Math.round(amount * multiplier)
}

export function fromMinorUnits(amount: number, currency: string): number {
  const multiplier = CURRENCY_MINOR_UNITS[currency.toUpperCase()] ?? 100
  return amount / multiplier
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  RUB: '₽',
  JPY: '¥',
  KRW: '₩',
}

export function formatPrice(minorUnits: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency
  const divisor = CURRENCY_MINOR_UNITS[currency.toUpperCase()] ?? 100
  const amount = minorUnits / divisor

  if (divisor === 1) {
    return `${symbol}${amount.toLocaleString()}`
  }

  return `${symbol}${amount.toFixed(2)}`
}

// Try to parse price from a string like "$49.99", "1 490 ₽", "EUR 12.00"
export function parsePriceString(raw: string, hintCurrency?: string): { price: number; currency: string } | null {
  const cleaned = raw.replace(/\s/g, '').trim()

  // Try common patterns
  const patterns: Array<{ regex: RegExp; currency: string }> = [
    { regex: /^\$(\d+(?:[.,]\d{1,2})?)$/, currency: 'USD' },
    { regex: /^€(\d+(?:[.,]\d{1,2})?)$/, currency: 'EUR' },
    { regex: /^£(\d+(?:[.,]\d{1,2})?)$/, currency: 'GBP' },
    { regex: /^(\d+(?:[.,]\d{1,2})?)₽$/, currency: 'RUB' },
    { regex: /^¥(\d+)$/, currency: 'JPY' },
    { regex: /^USD(\d+(?:[.,]\d{1,2})?)$/, currency: 'USD' },
    { regex: /^EUR(\d+(?:[.,]\d{1,2})?)$/, currency: 'EUR' },
    { regex: /^RUB(\d+(?:[.,]\d{1,2})?)$/, currency: 'RUB' },
    { regex: /^(\d+(?:[.,]\d{1,2})?)$/, currency: hintCurrency ?? 'USD' },
  ]

  for (const { regex, currency } of patterns) {
    const match = cleaned.match(regex)
    if (match) {
      const numStr = (match[1] ?? match[0]).replace(',', '.')
      const parsed = parseFloat(numStr)
      if (!isNaN(parsed)) {
        return { price: toMinorUnits(parsed, currency), currency }
      }
    }
  }

  return null
}
