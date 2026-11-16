import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayFineUseCase } from '../../src/application/usecases/fine/pay-fine';
import { Fine } from '../../src/domain/entities/fine.entity';

const mockFines = new Map<string, Fine>();
const mockReports = new Map<string, any>();
const mockAudits: any[] = [];

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

describe('PayFineUseCase & payFine callable', () => {
  const fakeTx = {} as any;
  const fakeRunner = {
    run: async <T>(work: (tx: any) => Promise<T>) => work(fakeTx),
  };

  function makeUseCase(initialFine: Fine) {
    let fine: Fine = { ...initialFine };
    const reportStatusUpdates: string[] = [];
    const fineRepository = {
      create: vi.fn(),
      getById: vi.fn(async () => ({ ...fine })),
      update: vi.fn(async (_id: string, updates: Partial<Fine>) => {
        fine = { ...fine, ...updates };
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

    return { getFine: () => fine, reportStatusUpdates, enforcementAuditPort, useCase };
  }

  beforeEach(() => {
    mockFines.clear();
    mockReports.clear();
    mockAudits.length = 0;
  });

  it('rejects cancelled fines and pending-dispute fines, while allowing rejected-dispute fines to be paid', async () => {
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
      cancelled.useCase.execute({ fineId: 'fine-c', userId: 'owner-1' })
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
      pendingDispute.useCase.execute({ fineId: 'fine-p', userId: 'owner-1' })
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
    await expect(
      rejectedDispute.useCase.execute({ fineId: 'fine-r', userId: 'owner-1' })
    ).resolves.toEqual({ ok: true });
    expect(rejectedDispute.getFine().status).toBe('paid');
    expect(rejectedDispute.reportStatusUpdates).toEqual(['resolved']);
    expect(rejectedDispute.enforcementAuditPort.addAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAY_FINE', targetId: 'fine-r', actorId: 'owner-1' }),
      fakeTx
    );
  });

  it('derives userId from auth context rather than client payload on payFine callable', async () => {
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
        data: { fineId: 'fine-1', userId: 'owner-1' },
      } as any)
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
