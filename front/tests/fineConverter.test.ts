import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('vue', () => ({
  ref: (v: any) => ({ value: v }),
  computed: (fn: () => any) => ({ get value() { return fn(); } }),
}));

vi.mock('pinia', () => ({
  defineStore: (_id: string, setup: () => any) => setup,
}));

vi.mock('vuefire', () => ({
  useFirestore: () => ({}),
  useCollection: () => ({ data: { value: [] }, pending: { value: false } }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

let normalizeFineFromFirestore: (id: string, data: Record<string, any>) => any;

beforeAll(async () => {
  ({ normalizeFineFromFirestore } = await import('../app/stores/fines'));
});

describe('normalizeFineFromFirestore', () => {
  it('handles cancelled status, disputeStatus, evidencePhotos, and optional dispute/resolution timestamps', () => {
    const fine = normalizeFineFromFirestore('fine-1', {
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      amount: 100,
      status: 'cancelled',
      disputeStatus: 'accepted',
      disputeReason: 'Wrong plate',
      resolutionReason: 'Cancelled after review',
      originalPlateNumber: 'AB-128-CD',
      evidencePhotos: [{ path: 'reports/agent-1/plate.jpg', slot: 'plate' }],
      issuedAt: { toMillis: () => 1700000000000 },
      paidAt: { seconds: 1700000300 },
      paymentReference: 'PA-20261124-AABBCCDDEEFF',
      paymentProvider: 'simulated',
      paymentAttemptId: 'attempt-12345678',
      disputedAt: { seconds: 1700000100 },
      resolvedAt: { _seconds: 1700000200 },
    });

    expect(fine).toEqual({
      id: 'fine-1',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      amount: 100,
      status: 'cancelled',
      disputeStatus: 'accepted',
      disputeReason: 'Wrong plate',
      resolutionReason: 'Cancelled after review',
      originalPlateNumber: 'AB-128-CD',
      evidencePhotos: [{ path: 'reports/agent-1/plate.jpg', slot: 'plate' }],
      issuedAt: 1700000000000,
      paidAt: 1700000300000,
      paymentReference: 'PA-20261124-AABBCCDDEEFF',
      paymentProvider: 'simulated',
      paymentAttemptId: 'attempt-12345678',
      disputedAt: 1700000100000,
      resolvedAt: 1700000200000,
    });
  });

  it('keeps paidAt, payment metadata, disputedAt, and resolvedAt undefined when missing on historical fines', () => {
    const legacy = normalizeFineFromFirestore('fine-legacy', {
      reportId: 'rep-old',
      ownerId: 'owner-1',
      plateNumber: 'XY-999-ZZ',
      amount: 50,
      status: 'unpaid',
      issuedAt: { toMillis: () => 1690000000000 },
    });

    expect(legacy.status).toBe('unpaid');
    expect(legacy.paidAt).toBeUndefined();
    expect(legacy.paymentReference).toBeUndefined();
    expect(legacy.paymentProvider).toBeUndefined();
    expect(legacy.paymentAttemptId).toBeUndefined();
    expect(legacy.disputeStatus).toBeUndefined();
    expect(legacy.evidencePhotos).toBeUndefined();
    expect(legacy.disputedAt).toBeUndefined();
    expect(legacy.resolvedAt).toBeUndefined();
  });
});
