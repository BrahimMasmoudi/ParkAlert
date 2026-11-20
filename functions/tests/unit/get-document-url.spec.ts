import { describe, expect, it, vi } from 'vitest';
import { Car } from '../../src/domain/entities/car.entity';
import { User } from '../../src/domain/entities/user.entity';
import { CarRepository } from '../../src/domain/repositories/car.repository';
import { DocumentStoragePort } from '../../src/domain/repositories/storage.port';
import { UserRepository } from '../../src/domain/repositories/user.repository';
import { GetDocumentUrlUseCase } from '../../src/application/usecases/car/get-document-url';

const users = new Map<string, User>([
  ['owner-a', { uid: 'owner-a', roles: ['owner'], name: 'A', email: 'a@test.com', createdAt: new Date() }],
  ['owner-b', { uid: 'owner-b', roles: ['owner'], name: 'B', email: 'b@test.com', createdAt: new Date() }],
  ['stranger', { uid: 'stranger', roles: ['owner'], name: 'S', email: 's@test.com', createdAt: new Date() }],
  ['police-1', { uid: 'police-1', roles: ['police', 'owner'], name: 'P', email: 'p@test.com', createdAt: new Date() }],
]);

describe('US2: GetDocumentUrlUseCase authorization', () => {
  it('revokes former Owner A access after transfer and allows Owner B and Police', async () => {
    const car: Car = {
      id: 'AB123CD',
      ownerId: 'owner-b',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      brand: 'Renault',
      model: 'Clio',
      color: 'Black',
      carteGriseUrl: 'transfers/owner-b/new-doc.pdf',
      status: 'active',
      ownershipHistory: ['owner-a'],
      createdAt: new Date(),
    };

    const carRepo = { getById: vi.fn(async () => car) } as unknown as CarRepository;
    const userRepo = { getById: vi.fn(async (uid: string) => users.get(uid) ?? null) } as unknown as UserRepository;
    const storagePort: DocumentStoragePort = {
      getSignedReadUrl: vi.fn(async (path: string) => ({ url: `https://signed.local/${path}`, expiresAt: 12345 })),
    };

    const useCase = new GetDocumentUrlUseCase(carRepo, userRepo, storagePort);

    await expect(
      useCase.execute({ carId: 'AB123CD', documentKind: 'active', callerId: 'owner-a' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    await expect(
      useCase.execute({ carId: 'AB123CD', documentKind: 'active', callerId: 'stranger' })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    await expect(
      useCase.execute({ carId: 'AB123CD', documentKind: 'active', callerId: 'owner-b' })
    ).resolves.toEqual({ url: 'https://signed.local/transfers/owner-b/new-doc.pdf', expiresAt: 12345 });

    await expect(
      useCase.execute({ carId: 'AB123CD', documentKind: 'active', callerId: 'police-1' })
    ).resolves.toEqual({ url: 'https://signed.local/transfers/owner-b/new-doc.pdf', expiresAt: 12345 });
  });

  it('allows pendingTransfer document reads only for Owner A, Owner B (while pending), and Police', async () => {
    const car: Car = {
      id: 'AB123CD',
      ownerId: 'owner-a',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      brand: 'Renault',
      model: 'Clio',
      color: 'Black',
      carteGriseUrl: 'carteGrise/owner-a/old.png',
      transferToOwnerId: 'owner-b',
      transferCarteGriseUrl: 'transfers/owner-b/new.pdf',
      status: 'transfer_pending_owner',
      createdAt: new Date(),
    };

    const carRepo = { getById: vi.fn(async () => car) } as unknown as CarRepository;
    const userRepo = { getById: vi.fn(async (uid: string) => users.get(uid) ?? null) } as unknown as UserRepository;
    const storagePort: DocumentStoragePort = {
      getSignedReadUrl: vi.fn(async (path: string) => ({ url: `https://signed.local/${path}`, expiresAt: 12345 })),
    };
    const useCase = new GetDocumentUrlUseCase(carRepo, userRepo, storagePort);

    await expect(useCase.execute({ carId: 'AB123CD', documentKind: 'pendingTransfer', callerId: 'owner-a' })).resolves.toBeTruthy();
    await expect(useCase.execute({ carId: 'AB123CD', documentKind: 'pendingTransfer', callerId: 'owner-b' })).resolves.toBeTruthy();
    await expect(useCase.execute({ carId: 'AB123CD', documentKind: 'pendingTransfer', callerId: 'police-1' })).resolves.toBeTruthy();
    await expect(useCase.execute({ carId: 'AB123CD', documentKind: 'pendingTransfer', callerId: 'stranger' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});
