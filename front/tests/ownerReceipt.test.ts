import { describe, expect, it, vi } from 'vitest';
import { createOwnerReceiptFetcher, parseReceiptSummary } from '../app/composables/useOwnerReceipt';

describe('useOwnerReceipt / createOwnerReceiptFetcher', () => {
  it('parses valid card summary and rejects incomplete shapes', () => {
    expect(
      parseReceiptSummary({
        cardholderName: 'Amira Ben Salah',
        cardBrand: 'visa',
        cardLast4: '4242',
      }),
    ).toEqual({
      cardholderName: 'Amira Ben Salah',
      cardBrand: 'visa',
      cardLast4: '4242',
    });

    expect(parseReceiptSummary({ cardholderName: '', cardBrand: 'visa', cardLast4: '4242' })).toBeNull();
    expect(parseReceiptSummary({ cardholderName: 'Amira', cardBrand: 'diners', cardLast4: '4242' })).toBeNull();
    expect(parseReceiptSummary({ cardholderName: 'Amira', cardBrand: 'visa', cardLast4: '12' })).toBeNull();
    expect(parseReceiptSummary(null)).toBeNull();
  });

  it('returns ready summary when document exists and UID matches pre and post await', async () => {
    const fetcher = createOwnerReceiptFetcher({
      getCurrentUid: () => 'owner-1',
      readSummaryDoc: vi.fn(async () => ({
        exists: true,
        data: { cardholderName: 'أميرة بن صالح', cardBrand: 'mastercard', cardLast4: '8888' },
      })),
    });

    await expect(fetcher.fetchReceiptSummary('fine-1', 'owner-1')).resolves.toEqual({
      status: 'ready',
      summary: { cardholderName: 'أميرة بن صالح', cardBrand: 'mastercard', cardLast4: '8888' },
    });
  });

  it('returns missing when document does not exist or has invalid shape', async () => {
    const missingDoc = createOwnerReceiptFetcher({
      getCurrentUid: () => 'owner-1',
      readSummaryDoc: async () => ({ exists: false, data: null }),
    });
    await expect(missingDoc.fetchReceiptSummary('fine-1', 'owner-1')).resolves.toEqual({ status: 'missing' });

    const invalidShape = createOwnerReceiptFetcher({
      getCurrentUid: () => 'owner-1',
      readSummaryDoc: async () => ({ exists: true, data: { cardBrand: 'visa' } }),
    });
    await expect(invalidShape.fetchReceiptSummary('fine-1', 'owner-1')).resolves.toEqual({ status: 'missing' });
  });

  it('rejects when UID changes before or during Firestore fetch', async () => {
    let activeUid: string | null = 'owner-1';
    const switchedMidFlight = createOwnerReceiptFetcher({
      getCurrentUid: () => activeUid,
      readSummaryDoc: async () => {
        activeUid = 'owner-2';
        return {
          exists: true,
          data: { cardholderName: 'Amira', cardBrand: 'visa', cardLast4: '1234' },
        };
      },
    });

    await expect(switchedMidFlight.fetchReceiptSummary('fine-1', 'owner-1')).rejects.toThrow(
      'Authentication state changed',
    );
  });

  it('propagates Firestore fetch errors cleanly without swallowing them', async () => {
    const failing = createOwnerReceiptFetcher({
      getCurrentUid: () => 'owner-1',
      readSummaryDoc: async () => {
        throw new Error('permission-denied');
      },
    });

    await expect(failing.fetchReceiptSummary('fine-1', 'owner-1')).rejects.toThrow('permission-denied');
  });
});
