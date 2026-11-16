import { describe, expect, it, vi } from 'vitest';
import { DismissReportUseCase } from '../../src/application/usecases/report/dismiss-report';

function makeTxRunner() {
  return {
    run: vi.fn(async (fn: (tx: any) => Promise<any>) => fn({})),
  };
}

describe('DismissReportUseCase', () => {
  it('closes a pending report as resolved with reason and audit log', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({ id: 'rep-1', status: 'pending' }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'pol-1', role: 'police' }),
      update: vi.fn(),
    };
    const auditPort = { addAuditLog: vi.fn() };
    const useCase = new DismissReportUseCase(
      reportRepository as any,
      userRepository as any,
      auditPort,
      makeTxRunner() as any
    );

    const res = await useCase.execute({
      reportId: 'rep-1',
      reason: 'Plate photo is blurred',
      actorId: 'pol-1',
    });

    expect(res).toEqual({ ok: true });
    expect(reportRepository.update).toHaveBeenCalledWith(
      'rep-1',
      expect.objectContaining({
        status: 'resolved',
        resolutionReason: 'Plate photo is blurred',
        resolvedBy: 'pol-1',
      }),
      expect.anything()
    );
    expect(auditPort.addAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DISMISS_REPORT', targetId: 'rep-1' }),
      expect.anything()
    );
  });

  it('rejects non-police callers, short reasons, and non-pending reports', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({ id: 'rep-1', status: 'resolved' }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'agent-1', role: 'agent' }),
      update: vi.fn(),
    };
    const auditPort = { addAuditLog: vi.fn() };
    const useCase = new DismissReportUseCase(
      reportRepository as any,
      userRepository as any,
      auditPort,
      makeTxRunner() as any
    );

    await expect(
      useCase.execute({ reportId: 'rep-1', reason: 'no', actorId: 'pol-1' })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(
      useCase.execute({ reportId: 'rep-1', reason: 'Blurry plate', actorId: 'agent-1' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    userRepository.getById.mockResolvedValue({ id: 'pol-1', role: 'police' });
    await expect(
      useCase.execute({ reportId: 'rep-1', reason: 'Blurry plate', actorId: 'pol-1' })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
  });
});
