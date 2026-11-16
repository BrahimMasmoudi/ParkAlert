import { describe, expect, it, vi } from 'vitest';
import { GetEvidenceUrlsUseCase } from '../../src/application/usecases/evidence/get-evidence-urls';

describe('GetEvidenceUrlsUseCase', () => {
  it('authorizes police and submitting agent on reports, isolates missing slots, and preserves http:// legacy URLs', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'rep-1',
        agentId: 'agent-1',
        photos: [
          { path: 'reports/agent-1/ctx.jpg', slot: 'context' },
          { path: 'reports/agent-1/missing.jpg', slot: 'plate' },
        ],
      }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const fineRepository = { create: vi.fn(), getById: vi.fn(), update: vi.fn(), hasUnpaidFines: vi.fn() };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'agent-1', role: 'agent' }),
      update: vi.fn(),
    };
    const storagePort = {
      verifyRasterImage: vi.fn(),
      getSignedReadUrl: vi.fn(async (path: string) => {
        if (path.includes('missing')) throw new Error('NOT_FOUND');
        return { url: `https://signed.example/${path}`, expiresAt: 12345 };
      }),
    };

    const useCase = new GetEvidenceUrlsUseCase(
      reportRepository as any,
      fineRepository as any,
      userRepository as any,
      storagePort
    );

    const res = await useCase.execute({
      targetType: 'report',
      targetId: 'rep-1',
      callerId: 'agent-1',
    });

    expect(res.items).toEqual([
      { slot: 'context', url: 'https://signed.example/reports/agent-1/ctx.jpg', expiresAt: 12345 },
      { slot: 'plate', url: null, expiresAt: null, error: 'not_found' },
    ]);

    reportRepository.getById.mockResolvedValue({
      id: 'rep-legacy',
      agentId: 'agent-1',
      photoUrl: 'http://127.0.0.1:9199/v0/b/demo/o/photo.jpg',
    });
    userRepository.getById.mockResolvedValue({ id: 'pol-1', role: 'police' });
    const legacyRes = await useCase.execute({
      targetType: 'report',
      targetId: 'rep-legacy',
      callerId: 'pol-1',
    });
    expect(legacyRes.items).toEqual([
      { slot: 'context', url: 'http://127.0.0.1:9199/v0/b/demo/o/photo.jpg', expiresAt: null },
    ]);
  });

  it('denies non-submitting agents on report evidence', async () => {
    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({ id: 'rep-1', agentId: 'agent-1', photos: [] }),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };
    const fineRepository = { create: vi.fn(), getById: vi.fn(), update: vi.fn(), hasUnpaidFines: vi.fn() };
    const userRepository = { getById: vi.fn().mockResolvedValue({ id: 'agent-2', role: 'agent' }), update: vi.fn() };
    const storagePort = { verifyRasterImage: vi.fn(), getSignedReadUrl: vi.fn() };

    const useCase = new GetEvidenceUrlsUseCase(
      reportRepository as any,
      fineRepository as any,
      userRepository as any,
      storagePort
    );

    await expect(
      useCase.execute({ targetType: 'report', targetId: 'rep-1', callerId: 'agent-2' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});
