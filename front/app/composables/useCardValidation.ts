export const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'discover'] as const
export type CardBrand = (typeof CARD_BRANDS)[number]
export type CardErrorKey = string | null

export interface CardRule {
  lengths: number[]
  cvvLength: 3 | 4
  groups: number[]
}

const CARD_RULES: Record<CardBrand, CardRule> = {
  visa: { lengths: [13, 16, 19], cvvLength: 3, groups: [4, 4, 4, 4, 3] },
  mastercard: { lengths: [16], cvvLength: 3, groups: [4, 4, 4, 4] },
  amex: { lengths: [15], cvvLength: 4, groups: [4, 6, 5] },
  discover: { lengths: [16], cvvLength: 3, groups: [4, 4, 4, 4] },
}

export function stripCardDigits(value: string): string {
  return String(value || '').replace(/\D+/g, '')
}

export function detectCardBrand(digits: string): CardBrand | null {
  if (!digits) return null
  if (digits.startsWith('34') || digits.startsWith('37')) return 'amex'
  if (digits.startsWith('4')) return 'visa'

  if (digits.length >= 2) {
    const p2 = Number(digits.slice(0, 2))
    if (p2 >= 51 && p2 <= 55) return 'mastercard'
  }
  if (digits.startsWith('2')) {
    if (digits.length >= 4) {
      const p4 = Number(digits.slice(0, 4))
      if (p4 >= 2221 && p4 <= 2720) return 'mastercard'
    }
    return null
  }

  if (digits.startsWith('65')) return 'discover'
  if (digits.startsWith('64')) {
    if (digits.length >= 3) {
      const p3 = Number(digits.slice(0, 3))
      if (p3 >= 644 && p3 <= 649) return 'discover'
    }
    return null
  }
  if (digits.startsWith('6011')) return 'discover'

  return null
}

function canStillMatchSupportedBrand(digits: string): boolean {
  if (!digits) return true
  if (detectCardBrand(digits) !== null) return true

  if (digits === '3' || digits === '5' || digits === '6') return true
  if (digits.startsWith('2') && digits.length < 4) {
    const pad = 4 - digits.length
    const min = Number(digits + '0'.repeat(pad))
    const max = Number(digits + '9'.repeat(pad))
    return max >= 2221 && min <= 2720
  }
  if ((digits === '60' || digits === '601')) return true
  if (digits === '64') return true

  return false
}

export function getCardRule(brand: CardBrand): CardRule {
  return CARD_RULES[brand]
}

export function formatCardNumber(value: string): string {
  const rawDigits = stripCardDigits(value)
  const brand = detectCardBrand(rawDigits)
  const rule = brand ? getCardRule(brand) : null
  const maxLen = rule ? Math.max(...rule.lengths) : 19
  const digits = rawDigits.slice(0, maxLen)
  const groups = rule ? rule.groups : [4, 4, 4, 4, 3]

  const parts: string[] = []
  let idx = 0
  for (const size of groups) {
    if (idx >= digits.length) break
    parts.push(digits.slice(idx, idx + size))
    idx += size
  }
  return parts.join(' ')
}

export function formatExpiry(value: string): string {
  const trimmed = String(value || '').trim()

  const isoMatch = trimmed.match(/^(\d{4})\D+(\d{1,2})$/)
  if (isoMatch) {
    const mm = isoMatch[2]!.padStart(2, '0').slice(0, 2)
    const yy = isoMatch[1]!.slice(-2)
    return `${mm}/${yy}`
  }

  const slashFourMatch = trimmed.match(/^(\d{1,2})\D+(\d{4})$/)
  if (slashFourMatch) {
    const mm = slashFourMatch[1]!.padStart(2, '0').slice(0, 2)
    const yy = slashFourMatch[2]!.slice(-2)
    return `${mm}/${yy}`
  }

  const rawDigits = stripCardDigits(trimmed)
  if (rawDigits.length === 6 && (rawDigits.slice(2, 4) === '20' || rawDigits.slice(2, 4) === '19')) {
    return `${rawDigits.slice(0, 2)}/${rawDigits.slice(4, 6)}`
  }

  const digits = rawDigits.slice(0, 4)
  if (digits.length > 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`
  }
  return digits
}

export function luhnCheck(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  let doubleNext = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48
    if (doubleNext) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    doubleNext = !doubleNext
  }
  return sum % 10 === 0
}

export function validateCardholderName(value: string): CardErrorKey {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return 'owner.fines.payment_modal.errors.cardholder_required'
  }
  if (trimmed.length < 2 || trimmed.length > 100) {
    return 'owner.fines.payment_modal.errors.cardholder_invalid'
  }
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) {
      return 'owner.fines.payment_modal.errors.cardholder_invalid'
    }
  }
  return null
}

export function validateCardNumber(value: string): CardErrorKey {
  const digits = stripCardDigits(value)
  if (!digits) {
    return 'owner.fines.payment_modal.errors.card_number_required'
  }
  const brand = detectCardBrand(digits)
  if (!brand) {
    if (!canStillMatchSupportedBrand(digits)) {
      return 'owner.fines.payment_modal.errors.card_brand_unsupported'
    }
    return 'owner.fines.payment_modal.errors.card_number_invalid'
  }
  const rule = getCardRule(brand)
  if (!rule.lengths.includes(digits.length) || !luhnCheck(digits)) {
    return 'owner.fines.payment_modal.errors.card_number_invalid'
  }
  return null
}

export function validateExpiry(value: string, referenceDate: Date = new Date()): CardErrorKey {
  const rawDigits = stripCardDigits(value)
  if (!rawDigits) {
    return 'owner.fines.payment_modal.errors.expiry_required'
  }
  const normalized = formatExpiry(value)
  const match = normalized.match(/^(\d{2})\/(\d{2})$/)
  if (!match) {
    return 'owner.fines.payment_modal.errors.expiry_format'
  }
  const month = Number(match[1])
  const yy = Number(match[2])
  const year = 2000 + yy
  const curYear = referenceDate.getFullYear()
  const curMonth = referenceDate.getMonth() + 1

  if (month < 1 || month > 12 || year > curYear + 20) {
    return 'owner.fines.payment_modal.errors.expiry_format'
  }
  if (year < curYear || (year === curYear && month < curMonth)) {
    return 'owner.fines.payment_modal.errors.expiry_expired'
  }
  return null
}

export function validateCvv(value: string, brand: CardBrand | null): CardErrorKey {
  const digits = stripCardDigits(value)
  if (!digits) {
    return 'owner.fines.payment_modal.errors.cvv_required'
  }
  const expectedLength = brand === 'amex' ? 4 : 3
  if (digits.length !== expectedLength) {
    return 'owner.fines.payment_modal.errors.cvv_invalid'
  }
  return null
}

export function useCardValidation() {
  return {
    CARD_BRANDS,
    stripCardDigits,
    detectCardBrand,
    getCardRule,
    formatCardNumber,
    formatExpiry,
    luhnCheck,
    validateCardholderName,
    validateCardNumber,
    validateExpiry,
    validateCvv,
  }
}
