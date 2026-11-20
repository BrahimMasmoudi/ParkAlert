import { describe, expect, it, vi } from 'vitest';
import { DismissReportUseCase } from '../../src/application/usecases/report/dismiss-report';

function makeTxRunner() {
  return {
    run: vi.fn(async (fn: (tx: any) => Promise<any>) => fn({})),
  };
}

describe('DismissReportUseCase', () => {
  it('closes a pending report as resolved with reason and audit log (allowing unregistered or plate-less reports)', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({ id: 'rep-1', status: 'pending' }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'pol-1', roles: ['police', 'owner'] }),
      update: vi.fn(),
    };
    const carRepository = {
      getAllByPlateNumber: vi.fn().mockResolvedValue([]),
    };
    const auditPort = { addAuditLog: vi.fn() };
    const useCase = new DismissReportUseCase(
      reportRepository as any,
      userRepository as any,
      auditPort,
      makeTxRunner() as any,
      carRepository as any
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
      getById: vi.fn().mockResolvedValue({ id: 'agent-1', roles: ['agent', 'owner'] }),
      update: vi.fn(),
    };
    const carRepository = {
      getAllByPlateNumber: vi.fn().mockResolvedValue([]),
    };
    const auditPort = { addAuditLog: vi.fn() };
    const useCase = new DismissReportUseCase(
      reportRepository as any,
      userRepository as any,
      auditPort,
      makeTxRunner() as any,
      carRepository as any
    );

    await expect(
      useCase.execute({ reportId: 'rep-1', reason: 'no', actorId: 'pol-1' })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(
      useCase.execute({ reportId: 'rep-1', reason: 'Blurry plate', actorId: 'agent-1' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    userRepository.getById.mockResolvedValue({ id: 'pol-1', roles: ['police', 'owner'] });
    await expect(
      useCase.execute({ reportId: 'rep-1', reason: 'Blurry plate', actorId: 'pol-1' })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
  });

  it('blocks police self-enforcement when report.plateNumber or report.originalPlateNumber belongs to the acting officer (including rejected/archived/colliding vehicles)', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'rep-self',
        plateNumber: 'XX-999-XX',
        originalPlateNumber: 'PO-123-PO',
        status: 'pending',
      }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'pol-1', roles: ['police', 'owner'] }),
      update: vi.fn(),
    };
    const carRepository = {
      getAllByPlateNumber: vi.fn(async (plate: string) => {
        if (plate === 'PO-123-PO') {
          return [
            { id: 'OTHER', ownerId: 'owner-2', status: 'active' },
            { id: 'PO123PO', ownerId: 'pol-1', status: 'rejected' },
          ];
        }
        return [];
      }),
    };
    const auditPort = { addAuditLog: vi.fn() };
    const useCase = new DismissReportUseCase(
      reportRepository as any,
      userRepository as any,
      auditPort,
      makeTxRunner() as any,
      carRepository as any
    );

    await expect(
      useCase.execute({
        reportId: 'rep-self',
        reason: 'Blurred plate',
        actorId: 'pol-1',
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    expect(carRepository.getAllByPlateNumber).toHaveBeenCalledWith(
      'PO-123-PO',
      expect.anything(),
      { includeRejected: true, includeArchived: true }
    );
    expect(reportRepository.update).not.toHaveBeenCalled();
  });
});
