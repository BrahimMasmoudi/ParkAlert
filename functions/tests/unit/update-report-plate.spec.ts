import { describe, expect, it, vi } from 'vitest';
import { UpdatePendingReportPlateUseCase } from '../../src/application/usecases/report/update-report-plate';

function makeTxRunner() {
  return {
    run: vi.fn(async (fn: (tx: any) => Promise<any>) => fn({})),
  };
}

describe('UpdatePendingReportPlateUseCase', () => {
  it('updates a pending report plate for the submitting agent and preserves earliest originalPlateNumber', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'rep-1',
        agentId: 'agent-1',
        plateNumber: 'AB-123-CD',
        originalPlateNumber: 'AA-111-AA',
        status: 'pending',
      }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'agent-1', role: 'agent' }),
      update: vi.fn(),
    };
    const auditPort = { addAuditLog: vi.fn() };
    const useCase = new UpdatePendingReportPlateUseCase(
      reportRepository as any,
      userRepository as any,
      auditPort,
      makeTxRunner() as any
    );

    const res = await useCase.execute({
      reportId: 'rep-1',
      plateNumber: 'ab-999-zz',
      actorId: 'agent-1',
    });

    expect(res).toEqual({ ok: true });
    expect(reportRepository.update).toHaveBeenCalledWith(
      'rep-1',
      expect.objectContaining({
        plateNumber: 'AB-999-ZZ',
        originalPlateNumber: 'AA-111-AA',
        plateCorrectedBy: 'agent-1',
      }),
      expect.anything()
    );
    expect(auditPort.addAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_REPORT_PLATE', targetId: 'rep-1' }),
      expect.anything()
    );
  });

  it('rejects edits from another agent or on non-pending reports', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'rep-1',
        agentId: 'agent-1',
        plateNumber: 'AB-123-CD',
        status: 'investigated',
      }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'agent-1', role: 'agent' }),
      update: vi.fn(),
    };
    const auditPort = { addAuditLog: vi.fn() };
    const useCase = new UpdatePendingReportPlateUseCase(
      reportRepository as any,
      userRepository as any,
      auditPort,
      makeTxRunner() as any
    );

    await expect(
      useCase.execute({ reportId: 'rep-1', plateNumber: 'AB-999-ZZ', actorId: 'agent-1' })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });

    userRepository.getById.mockResolvedValue({ id: 'agent-2', role: 'agent' });
    await expect(
      useCase.execute({ reportId: 'rep-1', plateNumber: 'AB-999-ZZ', actorId: 'agent-2' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});
