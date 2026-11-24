import { randomBytes } from 'node:crypto';
import { DomainError } from '../errors/domain.error';

export const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'discover'] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];

const CARD_LAST4_RE = /^\d{4}$/;
const PAYMENT_ATTEMPT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Validates and trims a cardholder name across Unicode scripts while blocking control characters.
 */
export function validateCardholderName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new DomainError('INVALID_ARGUMENT', 'cardholderName must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new DomainError('INVALID_ARGUMENT', 'cardholderName must be between 2 and 100 characters');
  }
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      throw new DomainError('INVALID_ARGUMENT', 'cardholderName contains invalid characters');
    }
  }
  return trimmed;
}

/**
 * Validates that a card brand matches one of the supported canonical brand identifiers.
 */
export function validateCardBrand(value: unknown): CardBrand {
  if (typeof value !== 'string' || !(CARD_BRANDS as readonly string[]).includes(value)) {
    throw new DomainError('INVALID_ARGUMENT', 'Unsupported cardBrand');
  }
  return value as CardBrand;
}

/**
 * Validates a masked 4-digit card suffix.
 */
export function validateCardLast4(value: unknown): string {
  if (typeof value !== 'string' || !CARD_LAST4_RE.test(value)) {
    throw new DomainError('INVALID_ARGUMENT', 'cardLast4 must be 4 digits');
  }
  return value;
}

/**
 * Validates an idempotent payment attempt identifier.
 */
export function validatePaymentAttemptId(value: unknown): string {
  if (typeof value !== 'string' || !PAYMENT_ATTEMPT_ID_RE.test(value)) {
    throw new DomainError('INVALID_ARGUMENT', 'Invalid paymentAttemptId');
  }
  return value;
}

/**
 * Generates a unique stateless payment reference in `PA-YYYYMMDD-<12 HEX>` format (UTC date).
 */
export function generatePaymentReference(now: Date = new Date()): string {
  const utcDate = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(6).toString('hex').toUpperCase();
  return `PA-${utcDate}-${suffix}`;
}
