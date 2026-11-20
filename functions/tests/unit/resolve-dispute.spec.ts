import { describe, expect, it, vi } from 'vitest';
import { ResolveDisputeUseCase } from '../../src/application/usecases/fine/resolve-dispute';
import { Fine } from '../../src/domain/entities/fine.entity';

const fakeTx = {} as any;
const fakeRunner = {
  run: async <T>(work: (tx: any) => Promise<T>) => work(fakeTx),
};

describe('ResolveDisputeUseCase', () => {
  function setup(options?: { reportId?: string; reportExists?: boolean; role?: string }) {
    let fine: Fine = {
      id: 'fine-1',
      reportId: options?.reportId ?? 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      amount: 50,
      status: 'unpaid',
      disputeStatus: 'pending',
      disputeReason: 'Wrong plate read',
      issuedBy: 'pol-1',
      issuedAt: new Date(),
    };
    const reportUpdates: Array<Record<string, any>> = [];
    const reportExists = options?.reportExists ?? true;

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
      getById: vi.fn(async (id: string) =>
        reportExists && id ? { id, status: 'investigated' } : null
      ),
      updateStatus: vi.fn(),
      update: vi.fn(async (_id: string, updates: Record<string, any>) => {
        reportUpdates.push(updates);
      }),
    };
    const userRepository = {
      getById: vi.fn(async () => ({
        uid: 'pol-2',
        roles: options?.role === 'owner' ? ['owner'] : ['police', 'owner'],
      })),
      update: vi.fn(),
    };
    const enforcementAuditPort = { addAuditLog: vi.fn().mockResolvedValue(undefined) };

    const useCase = new ResolveDisputeUseCase(
      fineRepository as any,
      reportRepository as any,
      userRepository as any,
      enforcementAuditPort,
      fakeRunner
    );

    return { getFine: () => fine, reportUpdates, reportRepository, enforcementAuditPort, useCase };
  }

  it('cancels the fine, sets disputeStatus=accepted, and closes the linked report on cancel_fine', async () => {
    const { getFine, reportUpdates, enforcementAuditPort, useCase } = setup();

    const res = await useCase.execute({
      fineId: 'fine-1',
      action: 'cancel_fine',
      reason: 'Confirmed misread plate',
      actorId: 'pol-2',
    });

    expect(res).toEqual({ ok: true });
    expect(getFine()).toMatchObject({
      status: 'cancelled',
      disputeStatus: 'accepted',
      resolutionReason: 'Confirmed misread plate',
      resolvedBy: 'pol-2',
    });
    expect(reportUpdates).toEqual([
      expect.objectContaining({
        status: 'resolved',
        resolutionReason: 'fine_cancelled',
        resolvedBy: 'pol-2',
      }),
    ]);
    expect(enforcementAuditPort.addAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANCEL_FINE', targetId: 'fine-1', actorId: 'pol-2' }),
      fakeTx
    );
  });

  it('marks disputeStatus=rejected on dismiss_dispute without altering unpaid fine status', async () => {
    const { getFine, reportUpdates, enforcementAuditPort, useCase } = setup();

    await useCase.execute({
      fineId: 'fine-1',
      action: 'dismiss_dispute',
      reason: 'Plate clearly visible in evidence photo',
      actorId: 'pol-2',
    });

    expect(getFine()).toMatchObject({
      status: 'unpaid',
      disputeStatus: 'rejected',
      resolutionReason: 'Plate clearly visible in evidence photo',
      resolvedBy: 'pol-2',
    });
    expect(reportUpdates).toHaveLength(0);
    expect(enforcementAuditPort.addAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DISMISS_DISPUTE', targetId: 'fine-1', actorId: 'pol-2' }),
      fakeTx
    );
  });

  it('skips report update safely when reportId is empty or linked report doc does not exist, and enforces police role', async () => {
    const missingReport = setup({ reportId: '', reportExists: false });
    await expect(
      missingReport.useCase.execute({
        fineId: 'fine-1',
        action: 'cancel_fine',
        reason: 'Legacy fine without report',
        actorId: 'pol-2',
      })
    ).resolves.toEqual({ ok: true });
    expect(missingReport.reportRepository.update).not.toHaveBeenCalled();

    const nonPolice = setup({ role: 'owner' });
    await expect(
      nonPolice.useCase.execute({
        fineId: 'fine-1',
        action: 'dismiss_dispute',
        reason: 'Attempt by owner',
        actorId: 'owner-1',
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('blocks police self-enforcement when resolving a dispute on their own fine', async () => {
    const { useCase, reportRepository } = setup();
    // Make pol-2 the fine owner in the test setup
    const fineRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'fine-self',
        reportId: 'rep-1',
        ownerId: 'pol-2',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        amount: 50,
        status: 'unpaid',
        disputeStatus: 'pending',
        issuedBy: 'pol-1',
        issuedAt: new Date(),
      }),
      update: vi.fn(),
      hasUnpaidFines: vi.fn(),
    };
    const selfUseCase = new ResolveDisputeUseCase(
      fineRepository as any,
      reportRepository as any,
      { getById: vi.fn(async () => ({ uid: 'pol-2', roles: ['police', 'owner'] })), update: vi.fn() } as any,
      { addAuditLog: vi.fn() },
      fakeRunner
    );

    await expect(
      selfUseCase.execute({
        fineId: 'fine-self',
        action: 'cancel_fine',
        reason: 'Self-enforcement attempt',
        actorId: 'pol-2',
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(fineRepository.update).not.toHaveBeenCalled();
    expect(useCase).toBeDefined();
  });
});
