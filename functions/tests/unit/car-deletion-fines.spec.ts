import { describe, expect, it, vi } from 'vitest';
import { RequestCarDeletionUseCase } from '../../src/application/usecases/car/request-car-deletion';
import { ApproveCarDeletionUseCase } from '../../src/application/usecases/car/approve-car-deletion';

const fakeTx = {} as any;
const fakeRunner = {
  run: async <T>(work: (tx: any) => Promise<T>) => work(fakeTx),
};

describe('Car deletion unpaid-fine guards', () => {
  function setup(carStatus: 'active' | 'deletion_requested', hasUnpaid: boolean) {
    const carRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue({
        id: 'AB123CD',
        ownerId: 'owner-1',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        status: carStatus,
      }),
      getByPlateNumber: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      addAuditLog: vi.fn().mockResolvedValue(undefined),
      generateId: () => 'id-1',
    };
    const fineRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      hasUnpaidFines: vi.fn().mockResolvedValue(hasUnpaid),
    };
    const userRepository = {
      getById: vi.fn(async (uid: string) =>
        uid === 'pol-1'
          ? { uid: 'pol-1', role: 'police' }
          : { uid: 'owner-1', role: 'owner' }
      ),
      update: vi.fn(),
    };
    return { carRepository, fineRepository, userRepository };
  }

  it('blocks RequestCarDeletionUseCase when vehicle has unpaid or disputed fines', async () => {
    const { carRepository, fineRepository, userRepository } = setup('active', true);
    const useCase = new RequestCarDeletionUseCase(
      carRepository as any,
      fineRepository as any,
      userRepository as any,
      fakeRunner
    );

    await expect(
      useCase.execute({ carId: 'AB123CD', userId: 'owner-1' })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
    expect(fineRepository.hasUnpaidFines).toHaveBeenCalledWith('owner-1', 'AB-123-CD', fakeTx);
    expect(carRepository.update).not.toHaveBeenCalled();
  });

  it('blocks ApproveCarDeletionUseCase when vehicle has unpaid or disputed fines, and allows when clear', async () => {
    const blocked = setup('deletion_requested', true);
    const blockedUseCase = new ApproveCarDeletionUseCase(
      blocked.carRepository as any,
      blocked.fineRepository as any,
      blocked.userRepository as any,
      fakeRunner
    );

    await expect(
      blockedUseCase.execute({ carId: 'AB123CD', actorId: 'pol-1' })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
    expect(blocked.carRepository.update).not.toHaveBeenCalled();

    const clear = setup('deletion_requested', false);
    const clearUseCase = new ApproveCarDeletionUseCase(
      clear.carRepository as any,
      clear.fineRepository as any,
      clear.userRepository as any,
      fakeRunner
    );

    await expect(
      clearUseCase.execute({ carId: 'AB123CD', actorId: 'pol-1' })
    ).resolves.toEqual({ ok: true });
    expect(clear.carRepository.update).toHaveBeenCalledWith(
      'AB123CD',
      expect.objectContaining({ status: 'archived' }),
      fakeTx
    );
  });
});
