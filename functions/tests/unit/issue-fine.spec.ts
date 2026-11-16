import { describe, expect, it, vi } from 'vitest';
import { IssueFineUseCase } from '../../src/application/usecases/fine/issue-fine';

function makeTxRunner() {
  return {
    run: vi.fn(async (fn: (tx: any) => Promise<any>) => fn({})),
  };
}

describe('IssueFineUseCase', () => {
  it('carries earliest originalPlateNumber from agent edit even when police keep corrected plate unchanged', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'rep-1',
        agentId: 'agent-1',
        plateNumber: 'AB-123-CD',
        originalPlateNumber: 'AA-111-AA',
        plateCorrectedBy: 'agent-1',
        plateCorrectedAt: new Date('2026-11-16T10:00:00Z'),
        photos: [
          { path: 'reports/agent-1/ctx.jpg', slot: 'context' },
          { path: 'reports/agent-1/plt.jpg', slot: 'plate' },
        ],
        status: 'pending',
      }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const fineRepository = {
      create: vi.fn().mockResolvedValue('fine-1'),
      getById: vi.fn(),
      update: vi.fn(),
      hasUnpaidFines: vi.fn(),
    };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'pol-1', role: 'police' }),
      update: vi.fn(),
    };
    const carRepository = {
      getByPlateNumber: vi.fn().mockResolvedValue({
        id: 'AB123CD',
        ownerId: 'owner-1',
        status: 'active',
      }),
    };
    const auditPort = { addAuditLog: vi.fn() };

    const useCase = new IssueFineUseCase(
      reportRepository as any,
      fineRepository as any,
      userRepository as any,
      carRepository as any,
      makeTxRunner() as any,
      auditPort
    );

    const res = await useCase.execute({
      reportId: 'rep-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      expectedPlateNumber: 'AB-123-CD',
      amount: 100,
      issuedBy: 'pol-1',
    });

    expect(res).toEqual({ ok: true, fineId: 'fine-1' });
    expect(fineRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        originalPlateNumber: 'AA-111-AA',
        plateCorrectedBy: 'agent-1',
        disputeStatus: 'none',
        evidencePhotos: [
          { path: 'reports/agent-1/ctx.jpg', slot: 'context' },
          { path: 'reports/agent-1/plt.jpg', slot: 'plate' },
        ],
      }),
      expect.anything()
    );
  });

  it('rejects duplicate fine, concurrent plate mismatch, and rejected vehicles', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'rep-1',
        plateNumber: 'AB-999-ZZ',
        status: 'pending',
      }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const fineRepository = { create: vi.fn(), getById: vi.fn(), update: vi.fn(), hasUnpaidFines: vi.fn() };
    const userRepository = { getById: vi.fn().mockResolvedValue({ id: 'pol-1', role: 'police' }), update: vi.fn() };
    const carRepository = { getByPlateNumber: vi.fn().mockResolvedValue({ ownerId: 'owner-1', status: 'rejected' }) };
    const useCase = new IssueFineUseCase(
      reportRepository as any,
      fineRepository as any,
      userRepository as any,
      carRepository as any,
      makeTxRunner() as any
    );

    await expect(
      useCase.execute({
        reportId: 'rep-1',
        ownerId: 'owner-1',
        plateNumber: 'AB-123-CD',
        expectedPlateNumber: 'AB-123-CD',
        amount: 100,
        issuedBy: 'pol-1',
      })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });

    await expect(
      useCase.execute({
        reportId: 'rep-1',
        ownerId: 'owner-1',
        plateNumber: 'AB-999-ZZ',
        expectedPlateNumber: 'AB-999-ZZ',
        amount: 100,
        issuedBy: 'pol-1',
      })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });

    reportRepository.getById.mockResolvedValue({ id: 'rep-1', plateNumber: 'AB-999-ZZ', status: 'investigated' });
    await expect(
      useCase.execute({
        reportId: 'rep-1',
        ownerId: 'owner-1',
        plateNumber: 'AB-999-ZZ',
        amount: 100,
        issuedBy: 'pol-1',
      })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
  });
});
