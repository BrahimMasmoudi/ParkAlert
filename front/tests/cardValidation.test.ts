import { describe, expect, it } from 'vitest'
import {
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  luhnCheck,
  stripCardDigits,
  validateCardNumber,
  validateCardholderName,
  validateCvv,
  validateExpiry,
} from '../app/composables/useCardValidation'

describe('useCardValidation helpers', () => {
  it('strips non-digit characters cleanly', () => {
    expect(stripCardDigits('4111-1111 1111 1111abc')).toBe('4111111111111111')
  })

  it('detects supported BIN prefixes including boundary ranges', () => {
    expect(detectCardBrand('4')).toBe('visa')
    expect(detectCardBrand('34')).toBe('amex')
    expect(detectCardBrand('37')).toBe('amex')
    expect(detectCardBrand('51')).toBe('mastercard')
    expect(detectCardBrand('55')).toBe('mastercard')
    expect(detectCardBrand('222')).toBeNull()
    expect(detectCardBrand('2220')).toBeNull()
    expect(detectCardBrand('2221')).toBe('mastercard')
    expect(detectCardBrand('2720')).toBe('mastercard')
    expect(detectCardBrand('2721')).toBeNull()
    expect(detectCardBrand('64')).toBeNull()
    expect(detectCardBrand('643')).toBeNull()
    expect(detectCardBrand('644')).toBe('discover')
    expect(detectCardBrand('649')).toBe('discover')
    expect(detectCardBrand('65')).toBe('discover')
    expect(detectCardBrand('6011')).toBe('discover')
    expect(detectCardBrand('3528')).toBeNull()
  })

  it('validates Luhn checksum and card lengths across brands', () => {
    expect(luhnCheck('4111111111111111')).toBe(true)
    expect(luhnCheck('4111111111111112')).toBe(false)
    expect(luhnCheck('378282246310005')).toBe(true)

    expect(validateCardNumber('')).toBe('owner.fines.payment_modal.errors.card_number_required')
    expect(validateCardNumber('4111 1111 1111 1111')).toBeNull()
  })

  it('handles Visa 13/16/19, Amex 15, Mastercard/Discover 16 lengths and unsupported Luhn-valid BINs', () => {
    // Construct valid Luhn numbers directly:
    expect(validateCardNumber('4111111111111')).toBe('owner.fines.payment_modal.errors.card_number_invalid') // 13 digits failing Luhn
    expect(validateCardNumber('4000000000006')).toBeNull() // 13-digit Luhn-valid Visa
    expect(validateCardNumber('4000000000000000006')).toBeNull() // 19-digit Luhn-valid Visa
    expect(validateCardNumber('378282246310005')).toBeNull() // 15-digit Amex
    expect(validateCardNumber('5500000000000004')).toBeNull() // 16-digit Mastercard
    expect(validateCardNumber('6011000990139424')).toBeNull() // 16-digit Discover
    expect(validateCardNumber('3530111333300000')).toBe('owner.fines.payment_modal.errors.card_brand_unsupported') // Luhn-valid JCB
  })

  it('formats card numbers by brand grouping and caps digits at 19 for unknown brands', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111')
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005')
    expect(formatCardNumber('353011133330000099999')).toBe('3530 1113 3330 0000 999')
  })

  it('normalizes typed and browser-autofilled expiry formats and enforces bounds', () => {
    expect(formatExpiry('0828')).toBe('08/28')
    expect(formatExpiry('08/2028')).toBe('08/28')
    expect(formatExpiry('2028-08')).toBe('08/28')
    expect(formatExpiry('082028')).toBe('08/28')

    const ref = new Date(2026, 10, 24) // Nov 2026
    expect(validateExpiry('', ref)).toBe('owner.fines.payment_modal.errors.expiry_required')
    expect(validateExpiry('11/26', ref)).toBeNull()
    expect(validateExpiry('10/26', ref)).toBe('owner.fines.payment_modal.errors.expiry_expired')
    expect(validateExpiry('00/28', ref)).toBe('owner.fines.payment_modal.errors.expiry_format')
    expect(validateExpiry('13/28', ref)).toBe('owner.fines.payment_modal.errors.expiry_format')
    expect(validateExpiry('11/46', ref)).toBeNull()
    expect(validateExpiry('11/47', ref)).toBe('owner.fines.payment_modal.errors.expiry_format')
  })

  it('validates CVV length per brand and cardholder Unicode boundaries', () => {
    expect(validateCvv('', 'visa')).toBe('owner.fines.payment_modal.errors.cvv_required')
    expect(validateCvv('123', 'visa')).toBeNull()
    expect(validateCvv('123', 'amex')).toBe('owner.fines.payment_modal.errors.cvv_invalid')
    expect(validateCvv('1234', 'amex')).toBeNull()

    expect(validateCardholderName('   ')).toBe('owner.fines.payment_modal.errors.cardholder_required')
    expect(validateCardholderName('A')).toBe('owner.fines.payment_modal.errors.cardholder_invalid')
    expect(validateCardholderName('أميرة بن صالح')).toBeNull()
    expect(validateCardholderName(`Bad${String.fromCharCode(7)}Name`)).toBe(
      'owner.fines.payment_modal.errors.cardholder_invalid',
    )
    expect(validateCardholderName('A'.repeat(101))).toBe(
      'owner.fines.payment_modal.errors.cardholder_invalid',
    )
  })
})
