import { describe, expect, it, vi } from 'vitest';
import { CreateReportUseCase } from '../../src/application/usecases/report/create-report';
import { DomainError } from '../../src/domain/errors/domain.error';

function makeDeps(overrides: { roles?: string[]; validRaster?: boolean } = {}) {
  const reportRepository = {
    create: vi.fn().mockResolvedValue('rep-1'),
    getById: vi.fn(),
    updateStatus: vi.fn(),
    update: vi.fn(),
  };
  const userRepository = {
    getById: vi.fn().mockResolvedValue(
      overrides.roles === undefined
        ? { id: 'agent-1', roles: ['agent', 'owner'] }
        : overrides.roles.length === 0
          ? null
          : { id: 'agent-1', roles: overrides.roles }
    ),
    update: vi.fn(),
  };
  const storagePort = {
    getSignedReadUrl: vi.fn(),
    verifyRasterImage: vi.fn().mockResolvedValue(overrides.validRaster ?? true),
  };
  return { reportRepository, userRepository, storagePort };
}

describe('CreateReportUseCase', () => {
  it('creates a pending report with 2 verified photos and returns reportId', async () => {
    const { reportRepository, userRepository, storagePort } = makeDeps();
    const useCase = new CreateReportUseCase(reportRepository as any, userRepository as any, storagePort);

    const res = await useCase.execute({
      agentId: 'agent-1',
      plateNumber: 'ab-123-cd',
      location: { lat: 36.8, lng: 10.1 },
      photos: [
        { path: 'reports/agent-1/ctx.jpg', slot: 'context' },
        { path: 'reports/agent-1/plt.jpg', slot: 'plate' },
      ],
    });

    expect(res).toEqual({ ok: true, reportId: 'rep-1' });
    expect(storagePort.verifyRasterImage).toHaveBeenCalledTimes(2);
    expect(reportRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent-1',
        plateNumber: 'AB-123-CD',
        status: 'pending',
        photos: [
          { path: 'reports/agent-1/ctx.jpg', slot: 'context' },
          { path: 'reports/agent-1/plt.jpg', slot: 'plate' },
        ],
      })
    );
  });

  it('rejects non-agent callers with PERMISSION_DENIED', async () => {
    const { reportRepository, userRepository, storagePort } = makeDeps({ roles: ['owner'] });
    const useCase = new CreateReportUseCase(reportRepository as any, userRepository as any, storagePort);

    await expect(
      useCase.execute({
        agentId: 'agent-1',
        plateNumber: 'AB-123-CD',
        address: 'Rue Habib Bourguiba',
        photos: [
          { path: 'reports/agent-1/a.jpg', slot: 'context' },
          { path: 'reports/agent-1/b.jpg', slot: 'plate' },
        ],
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('rejects fewer than 2 photos, missing plate slot, or duplicate slots', async () => {
    const { reportRepository, userRepository, storagePort } = makeDeps();
    const useCase = new CreateReportUseCase(reportRepository as any, userRepository as any, storagePort);

    await expect(
      useCase.execute({
        agentId: 'agent-1',
        plateNumber: 'AB-123-CD',
        address: 'Center',
        photos: [{ path: 'reports/agent-1/a.jpg', slot: 'context' }],
      })
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      useCase.execute({
        agentId: 'agent-1',
        plateNumber: 'AB-123-CD',
        address: 'Center',
        photos: [
          { path: 'reports/agent-1/a.jpg', slot: 'context' },
          { path: 'reports/agent-1/b.jpg', slot: 'context' },
        ],
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('rejects path belonging to another agent or failing storage raster check', async () => {
    const { reportRepository, userRepository, storagePort } = makeDeps({ validRaster: false });
    const useCase = new CreateReportUseCase(reportRepository as any, userRepository as any, storagePort);

    await expect(
      useCase.execute({
        agentId: 'agent-1',
        plateNumber: '1234-AB-567',
        address: 'Center',
        photos: [
          { path: 'reports/other-agent/a.jpg', slot: 'context' },
          { path: 'reports/agent-1/b.jpg', slot: 'plate' },
        ],
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(
      useCase.execute({
        agentId: 'agent-1',
        plateNumber: '1234-AB-567',
        address: 'Center',
        photos: [
          { path: 'reports/agent-1/a.jpg', slot: 'context' },
          { path: 'reports/agent-1/b.jpg', slot: 'plate' },
        ],
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('rejects invalid plate format matching frontend frenchPlateRegex', async () => {
    const { reportRepository, userRepository, storagePort } = makeDeps();
    const useCase = new CreateReportUseCase(reportRepository as any, userRepository as any, storagePort);

    await expect(
      useCase.execute({
        agentId: 'agent-1',
        plateNumber: '123-A-45',
        address: 'Center',
        photos: [
          { path: 'reports/agent-1/a.jpg', slot: 'context' },
          { path: 'reports/agent-1/b.jpg', slot: 'plate' },
        ],
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});
