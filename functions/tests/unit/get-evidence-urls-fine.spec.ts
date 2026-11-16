import { describe, expect, it, vi } from 'vitest';
import { GetEvidenceUrlsUseCase } from '../../src/application/usecases/evidence/get-evidence-urls';

describe('GetEvidenceUrlsUseCase (fine scope)', () => {
  it('allows owner to view evidence on active/paid fine, blocks owner on cancelled fine while allowing police, and returns empty array for legacy fines', async () => {
    const fineRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'fine-1',
        ownerId: 'owner-1',
        status: 'unpaid',
        evidencePhotos: [
          { path: 'reports/agent-1/ctx.jpg', slot: 'context' },
          { path: 'reports/agent-1/plate.jpg', slot: 'plate' },
        ],
      }),
      update: vi.fn(),
      hasUnpaidFines: vi.fn(),
    };
    const reportRepository = { create: vi.fn(), getById: vi.fn(), updateStatus: vi.fn(), update: vi.fn() };
    const userRepository = {
      getById: vi.fn(async (id: string) =>
        id === 'pol-1' ? { id: 'pol-1', role: 'police' } : { id, role: 'owner' }
      ),
      update: vi.fn(),
    };
    const storagePort = {
      verifyRasterImage: vi.fn(),
      getSignedReadUrl: vi.fn(async (path: string) => ({
        url: `https://signed.example/${path}`,
        expiresAt: 99999,
      })),
    };

    const useCase = new GetEvidenceUrlsUseCase(
      reportRepository as any,
      fineRepository as any,
      userRepository as any,
      storagePort
    );

    const ownerRes = await useCase.execute({
      targetType: 'fine',
      targetId: 'fine-1',
      callerId: 'owner-1',
    });
    expect(ownerRes.items).toHaveLength(2);
    expect(reportRepository.getById).not.toHaveBeenCalled();

    // Another owner is denied
    await expect(
      useCase.execute({ targetType: 'fine', targetId: 'fine-1', callerId: 'owner-2' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    // Cancelled fine: owner denied, police allowed
    fineRepository.getById.mockResolvedValue({
      id: 'fine-cancelled',
      ownerId: 'owner-1',
      status: 'cancelled',
      evidencePhotos: [{ path: 'reports/agent-1/plate.jpg', slot: 'plate' }],
    });

    await expect(
      useCase.execute({ targetType: 'fine', targetId: 'fine-cancelled', callerId: 'owner-1' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    const policeRes = await useCase.execute({
      targetType: 'fine',
      targetId: 'fine-cancelled',
      callerId: 'pol-1',
    });
    expect(policeRes.items).toHaveLength(1);

    // Legacy fine without evidencePhotos -> []
    fineRepository.getById.mockResolvedValue({
      id: 'fine-legacy',
      ownerId: 'owner-1',
      status: 'unpaid',
    });
    const legacyRes = await useCase.execute({
      targetType: 'fine',
      targetId: 'fine-legacy',
      callerId: 'owner-1',
    });
    expect(legacyRes.items).toEqual([]);
  });
});
