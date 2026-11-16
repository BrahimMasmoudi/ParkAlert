import { describe, expect, it } from 'vitest';
import { Car } from '../../src/domain/entities/car.entity';
import { User } from '../../src/domain/entities/user.entity';
import { CarRepository } from '../../src/domain/repositories/car.repository';
import { UserRepository } from '../../src/domain/repositories/user.repository';
import { CheckPlateAvailabilityUseCase } from '../../src/application/usecases/car/check-plate';

const users = new Map<string, User>([
  ['owner-a', { uid: 'owner-a', role: 'owner', name: 'A', email: 'a@test.com', createdAt: new Date() }],
  ['owner-b', { uid: 'owner-b', role: 'owner', name: 'B', email: 'b@test.com', createdAt: new Date() }],
  ['agent-1', { uid: 'agent-1', role: 'agent', name: 'Ag', email: 'ag@test.com', createdAt: new Date() }],
]);

describe('US5: CheckPlateAvailabilityUseCase privacy & caller-relative eligibility', () => {
  it('returns caller-relative flags without leaking ownerId or raw car status', async () => {
    const cars = new Map<string, Car>([
      [
        'ACTIVE01',
        {
          id: 'ACTIVE01',
          ownerId: 'owner-a',
          plateNumber: 'AC-TIVE-01',
          plateNumberNormalized: 'ACTIVE01',
          brand: 'Renault',
          model: 'Clio',
          color: 'Black',
          carteGriseUrl: 'carteGrise/owner-a/doc.png',
          status: 'active',
          createdAt: new Date(),
        },
      ],
      [
        'REJECT01',
        {
          id: 'REJECT01',
          ownerId: 'owner-a',
          plateNumber: 'RE-JECT-01',
          plateNumberNormalized: 'REJECT01',
          brand: 'Peugeot',
          model: '208',
          color: 'Blue',
          carteGriseUrl: 'carteGrise/owner-a/doc2.png',
          status: 'rejected',
          createdAt: new Date(),
        },
      ],
      [
        'TRANS01',
        {
          id: 'TRANS01',
          ownerId: 'owner-a',
          plateNumber: 'TR-ANS-01',
          plateNumberNormalized: 'TRANS01',
          brand: 'Peugeot',
          model: '308',
          color: 'Grey',
          carteGriseUrl: 'carteGrise/owner-a/doc3.png',
          status: 'transfer_pending_owner',
          createdAt: new Date(),
        },
      ],
    ]);

    const carRepo = {
      getByPlateNumber: async (plate: string) =>
        cars.get(plate.toUpperCase().replace(/[^A-Z0-9]/g, '')) ?? null,
    } as unknown as CarRepository;
    const userRepo = {
      getById: async (uid: string) => users.get(uid) ?? null,
    } as unknown as UserRepository;

    const uc = new CheckPlateAvailabilityUseCase(carRepo, userRepo);

    const availableRes = await uc.execute({ plateNumber: 'NEW-123-AA', callerId: 'owner-b' });
    expect(availableRes).toEqual({ available: true, eligibleForTransfer: false });

    const ownRes = await uc.execute({ plateNumber: 'AC-TIVE-01', callerId: 'owner-a' });
    expect(ownRes).toEqual({ available: false, eligibleForTransfer: false, reason: 'OWNED_BY_CALLER' });
    expect(JSON.stringify(ownRes)).not.toContain('owner-a');

    const eligibleRes = await uc.execute({ plateNumber: 'AC-TIVE-01', callerId: 'owner-b' });
    expect(eligibleRes).toEqual({ available: false, eligibleForTransfer: true });
    expect((eligibleRes as any).status).toBeUndefined();
    expect((eligibleRes as any).ownerIdMasked).toBeUndefined();

    const ineligibleRes = await uc.execute({ plateNumber: 'RE-JECT-01', callerId: 'owner-b' });
    expect(ineligibleRes).toEqual({ available: false, eligibleForTransfer: false, reason: 'INELIGIBLE_STATUS' });
    expect((ineligibleRes as any).status).toBeUndefined();

    const transferInProgress = await uc.execute({ plateNumber: 'TR-ANS-01', callerId: 'owner-b' });
    expect(transferInProgress).toEqual({
      available: false,
      eligibleForTransfer: false,
      reason: 'TRANSFER_IN_PROGRESS',
    });

    await expect(uc.execute({ plateNumber: 'AC-TIVE-01', callerId: 'agent-1' })).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });
});
