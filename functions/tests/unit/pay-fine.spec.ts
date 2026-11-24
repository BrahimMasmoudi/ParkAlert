import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from 'firebase-functions/logger';
import { PayFineUseCase } from '../../src/application/usecases/fine/pay-fine';
import { Fine, FineReceiptSummary } from '../../src/domain/entities/fine.entity';
import { FirestoreFineRepository } from '../../src/infrastructure/adapters/persistence/FirestoreFineRepository';

const mockFines = new Map<string, Fine>();
const mockReceipts = new Map<string, FineReceiptSummary>();
const mockReports = new Map<string, any>();
const mockAudits: any[] = [];

vi.mock('firebase-functions/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../src/infrastructure/entry-points/index', () => {
  const fakeTx = {} as any;
  return {
    transactionRunner: {
      run: async <T>(work: (tx: any) => Promise<T>) => work(fakeTx),
    },
    fineRepository: {
      getById: async (id: string) => mockFines.get(id) ?? null,
      update: async (id: string, updates: Partial<Fine>) => {
        const cur = mockFines.get(id);
        if (cur) mockFines.set(id, { ...cur, ...updates });
      },
      setReceiptSummary: async (id: string, receipt: FineReceiptSummary) => {
        mockReceipts.set(id, receipt);
      },
    },
    reportRepository: {
      getById: async (id: string) => mockReports.get(id) ?? null,
      updateStatus: async (id: string, status: string) => {
        const cur = mockReports.get(id);
        if (cur) mockReports.set(id, { ...cur, status });
      },
    },
    enforcementAuditPort: {
      addAuditLog: async (entry: any) => {
        mockAudits.push(entry);
      },
    },
  };
});

import { payFine } from '../../src/infrastructure/entry-points/fine/pay-fine';

const VALID_PAYMENT_META = {
  cardholderName: 'Amira Ben Salah',
  cardBrand: 'visa' as const,
  cardLast4: '4242',
  paymentAttemptId: 'attempt-12345678',
};

describe('PayFineUseCase & payFine callable', () => {
  const fakeTx = {} as any;
  const fakeRunner = {
    run: async <T>(work: (tx: any) => Promise<T>) => work(fakeTx),
  };

  function makeUseCase(initialFine: Fine | null) {
    let fine: Fine | null = initialFine ? { ...initialFine } : null;
    let receiptSummary: FineReceiptSummary | null = null;
    const reportStatusUpdates: string[] = [];
    const fineRepository = {
      create: vi.fn(),
      getById: vi.fn(async () => (fine ? { ...fine } : null)),
      update: vi.fn(async (_id: string, updates: Partial<Fine>) => {
        if (fine) fine = { ...fine, ...updates };
      }),
      setReceiptSummary: vi.fn(async (_id: string, receipt: FineReceiptSummary) => {
        receiptSummary = { ...receipt };
      }),
      hasUnpaidFines: vi.fn(),
    };
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn(async (id: string) => (id ? { id, status: 'investigated' } : null)),
      updateStatus: vi.fn(async (_id: string, status: string) => {
        reportStatusUpdates.push(status);
      }),
      update: vi.fn(),
    };
    const enforcementAuditPort = { addAuditLog: vi.fn().mockResolvedValue(undefined) };

    const useCase = new PayFineUseCase(
      fineRepository as any,
      reportRepository as any,
      enforcementAuditPort,
      fakeRunner
    );

    return {
      getFine: () => fine,
      getReceiptSummary: () => receiptSummary,
      fineRepository,
      reportStatusUpdates,
      enforcementAuditPort,
      useCase,
    };
  }

  beforeEach(() => {
    mockFines.clear();
    mockReceipts.clear();
    mockReports.clear();
    mockAudits.length = 0;
    vi.clearAllMocks();
  });

  it('rejects cancelled fines and pending-dispute fines, while settling rejected-dispute fines with metadata', async () => {
    const cancelled = makeUseCase({
      id: 'fine-c',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'cancelled',
      disputeStatus: 'accepted',
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    });
    await expect(
      cancelled.useCase.execute({ fineId: 'fine-c', userId: 'owner-1', ...VALID_PAYMENT_META })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });

    const pendingDispute = makeUseCase({
      id: 'fine-p',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'unpaid',
      disputeStatus: 'pending',
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    });
    await expect(
      pendingDispute.useCase.execute({ fineId: 'fine-p', userId: 'owner-1', ...VALID_PAYMENT_META })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });

    const rejectedDispute = makeUseCase({
      id: 'fine-r',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'unpaid',
      disputeStatus: 'rejected',
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    });
    const res = await rejectedDispute.useCase.execute({
      fineId: 'fine-r',
      userId: 'owner-1',
      ...VALID_PAYMENT_META,
    });
    expect(res).toEqual({
      ok: true,
      paymentReference: expect.stringMatching(/^PA-\d{8}-[A-F0-9]{12}$/),
    });
    expect(rejectedDispute.getFine()).toMatchObject({
      status: 'paid',
      paymentReference: res.paymentReference,
      paymentProvider: 'simulated',
      paymentAttemptId: VALID_PAYMENT_META.paymentAttemptId,
    });
    expect(rejectedDispute.getReceiptSummary()).toEqual({
      cardholderName: VALID_PAYMENT_META.cardholderName,
      cardBrand: VALID_PAYMENT_META.cardBrand,
      cardLast4: VALID_PAYMENT_META.cardLast4,
    });
    expect(rejectedDispute.reportStatusUpdates).toEqual(['resolved']);
    expect(rejectedDispute.enforcementAuditPort.addAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAY_FINE',
        targetId: 'fine-r',
        actorId: 'owner-1',
        paymentReference: res.paymentReference,
        paymentProvider: 'simulated',
      }),
      fakeTx
    );
    const auditEntry = rejectedDispute.enforcementAuditPort.addAuditLog.mock.calls[0][0];
    expect(auditEntry).not.toHaveProperty('cardholderName');
    expect(logger.info).toHaveBeenCalledTimes(1);
    const loggedMeta = (logger.info as any).mock.calls[0][1];
    expect(JSON.stringify(loggedMeta)).not.toContain(VALID_PAYMENT_META.cardholderName);
    expect(loggedMeta).not.toHaveProperty('cardholderName');
  });

  it('supports idempotent retries for matching paymentAttemptId and rejects mismatched or incomplete paid fines', async () => {
    const paidMatching = makeUseCase({
      id: 'fine-paid-ok',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'paid',
      paymentReference: 'PA-20261124-AABBCCDDEEFF',
      paymentProvider: 'simulated',
      paymentAttemptId: VALID_PAYMENT_META.paymentAttemptId,
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    });
    await expect(
      paidMatching.useCase.execute({
        fineId: 'fine-paid-ok',
        userId: 'owner-1',
        ...VALID_PAYMENT_META,
      })
    ).resolves.toEqual({ ok: true, paymentReference: 'PA-20261124-AABBCCDDEEFF' });
    expect(paidMatching.fineRepository.update).not.toHaveBeenCalled();
    expect(paidMatching.fineRepository.setReceiptSummary).not.toHaveBeenCalled();

    const paidMismatch = makeUseCase({
      id: 'fine-paid-diff',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'paid',
      paymentReference: 'PA-20261124-AABBCCDDEEFF',
      paymentProvider: 'simulated',
      paymentAttemptId: 'other-attempt-999',
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    });
    await expect(
      paidMismatch.useCase.execute({
        fineId: 'fine-paid-diff',
        userId: 'owner-1',
        ...VALID_PAYMENT_META,
      })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });

    const paidNoRef = makeUseCase({
      id: 'fine-paid-noref',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'paid',
      paymentAttemptId: VALID_PAYMENT_META.paymentAttemptId,
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    });
    await expect(
      paidNoRef.useCase.execute({
        fineId: 'fine-paid-noref',
        userId: 'owner-1',
        ...VALID_PAYMENT_META,
      })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
  });

  it('validates missing fine and domain argument bounds including Unicode cardholder names', async () => {
    const missing = makeUseCase(null);
    await expect(
      missing.useCase.execute({ fineId: 'missing', userId: 'owner-1', ...VALID_PAYMENT_META })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const validUnicode = makeUseCase({
      id: 'fine-uni',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'unpaid',
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    });
    await expect(
      validUnicode.useCase.execute({
        fineId: 'fine-uni',
        userId: 'owner-1',
        ...VALID_PAYMENT_META,
        cardholderName: '  أميرة بن صالح  ',
      })
    ).resolves.toMatchObject({ ok: true });
    expect(validUnicode.getReceiptSummary()?.cardholderName).toBe('أميرة بن صالح');

    const badCases: Array<Partial<typeof VALID_PAYMENT_META>> = [
      { cardholderName: 'A' },
      { cardholderName: 'A'.repeat(101) },
      { cardholderName: `Bad${String.fromCharCode(7)}Name` },
      { cardBrand: 'diners' as any },
      { cardLast4: '123' },
      { cardLast4: '12ab' },
      { paymentAttemptId: 'short' },
      { paymentAttemptId: 'bad$attempt' },
    ];
    for (const override of badCases) {
      await expect(
        validUnicode.useCase.execute({
          fineId: 'fine-uni',
          userId: 'owner-1',
          ...VALID_PAYMENT_META,
          ...override,
        })
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    }
  });

  it('derives userId from auth context and enforces strict allowlist on payFine callable', async () => {
    mockFines.set('fine-1', {
      id: 'fine-1',
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'unpaid',
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    });

    await expect(
      payFine.run({
        auth: { uid: 'attacker-uid' },
        data: { fineId: 'fine-1', ...VALID_PAYMENT_META },
      } as any)
    ).rejects.toMatchObject({ code: 'permission-denied' });

    await expect(
      payFine.run({
        auth: { uid: 'owner-1' },
        data: { fineId: 'fine-1', userId: 'owner-1', ...VALID_PAYMENT_META },
      } as any)
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    for (const badPayload of [null, 'string', ['fine-1'], { fineId: 'fine-1', extraKey: 'x', ...VALID_PAYMENT_META }]) {
      await expect(
        payFine.run({
          auth: { uid: 'owner-1' },
          data: badPayload,
        } as any)
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    }

    for (const rawKey of ['cardNumber', 'pan', 'cvv', 'cvc', 'expiry', 'expMonth', 'expYear']) {
      await expect(
        payFine.run({
          auth: { uid: 'owner-1' },
          data: { fineId: 'fine-1', ...VALID_PAYMENT_META, [rawKey]: 'secret' },
        } as any)
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    }
  });

  it('FirestoreFineRepository.setReceiptSummary writes owner-only card summary to receipt/summary', async () => {
    const receiptRef = { id: 'summary' };
    const docMock = vi.fn(() => ({
      collection: vi.fn(() => ({
        doc: vi.fn(() => receiptRef),
      })),
    }));
    const connector = {
      db: { collection: vi.fn(() => ({ doc: docMock })) },
      getFieldValue: () => ({ serverTimestamp: () => 'SERVER_TIME' }),
    } as any;
    const repo = new FirestoreFineRepository(connector);
    const setMock = vi.fn();
    await repo.setReceiptSummary(
      'fine-99',
      { cardholderName: 'Amira Ben Salah', cardBrand: 'visa', cardLast4: '4242' },
      { set: setMock }
    );
    expect(docMock).toHaveBeenCalledWith('fine-99');
    expect(setMock).toHaveBeenCalledWith(receiptRef, {
      cardholderName: 'Amira Ben Salah',
      cardBrand: 'visa',
      cardLast4: '4242',
    });
  });
});
