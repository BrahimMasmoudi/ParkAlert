import { describe, expect, it, vi } from 'vitest';
import { DisputeFineUseCase } from '../../src/application/usecases/fine/dispute-fine';
import { Fine } from '../../src/domain/entities/fine.entity';

const fakeTx = {} as any;
const fakeRunner = {
  run: async <T>(work: (tx: any) => Promise<T>) => work(fakeTx),
};

describe('DisputeFineUseCase', () => {
  function setup(initialFine?: Partial<Fine>) {
    let fine: Fine | null = initialFine === null
      ? null
      : {
          id: 'fine-1',
          reportId: 'rep-1',
          ownerId: 'owner-1',
          plateNumber: 'AB-123-CD',
          plateNumberNormalized: 'AB123CD',
          amount: 50,
          status: 'unpaid',
          issuedBy: 'pol-1',
          issuedAt: new Date(),
          ...initialFine,
        };

    const fineRepository = {
      create: vi.fn(),
      getById: vi.fn(async () => (fine ? { ...fine } : null)),
      update: vi.fn(async (_id: string, updates: Partial<Fine>) => {
        fine = fine ? { ...fine, ...updates } : null;
      }),
      hasUnpaidFines: vi.fn(),
    };
    const enforcementAuditPort = { addAuditLog: vi.fn().mockResolvedValue(undefined) };
    const useCase = new DisputeFineUseCase(
      fineRepository as any,
      enforcementAuditPort,
      fakeRunner
    );

    return { getFine: () => fine, fineRepository, enforcementAuditPort, useCase };
  }

  it('allows the owner to submit one dispute on an unpaid fine even when disputeStatus is undefined (historical fine)', async () => {
    const { getFine, enforcementAuditPort, useCase } = setup();

    const res = await useCase.execute({
      fineId: 'fine-1',
      reason: '  My car was in the garage at this time.  ',
      actorId: 'owner-1',
    });

    expect(res).toEqual({ ok: true });
    expect(getFine()).toMatchObject({
      status: 'unpaid',
      disputeStatus: 'pending',
      disputeReason: 'My car was in the garage at this time.',
    });
    expect(getFine()?.disputedAt).toBeInstanceOf(Date);
    expect(enforcementAuditPort.addAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'fine',
        targetId: 'fine-1',
        actorId: 'owner-1',
        action: 'DISPUTE_FINE',
        reason: 'My car was in the garage at this time.',
      }),
      fakeTx
    );

    // Second dispute attempt must fail
    await expect(
      useCase.execute({
        fineId: 'fine-1',
        reason: 'Trying to dispute twice',
        actorId: 'owner-1',
      })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
  });

  it('enforces owner-only, unpaid-only, and reason length bounds (3..500 chars)', async () => {
    const { useCase } = setup({ disputeStatus: 'none' });
    await expect(
      useCase.execute({ fineId: 'fine-1', reason: 'Valid reason here', actorId: 'owner-2' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    await expect(
      useCase.execute({ fineId: 'fine-1', reason: 'no', actorId: 'owner-1' })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(
      useCase.execute({ fineId: 'fine-1', reason: 'x'.repeat(501), actorId: 'owner-1' })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    const paidSetup = setup({ status: 'paid' });
    await expect(
      paidSetup.useCase.execute({ fineId: 'fine-1', reason: 'Already paid', actorId: 'owner-1' })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });

    const rejectedSetup = setup({ status: 'unpaid', disputeStatus: 'rejected' });
    await expect(
      rejectedSetup.useCase.execute({ fineId: 'fine-1', reason: 'Re-appeal', actorId: 'owner-1' })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
  });
});
