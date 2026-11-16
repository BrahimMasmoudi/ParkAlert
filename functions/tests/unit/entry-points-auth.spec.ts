import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { DomainError } from '../../src/domain/errors/domain.error';
import { mapDomainErrorToHttpsError } from '../../src/infrastructure/entry-points/shared/error-mapper';

const mockCars = new Map<string, any>();
const mockUsers = new Map<string, any>();

vi.mock('../../src/infrastructure/entry-points/index', () => {
  const fakeTx = {} as any;
  return {
    transactionRunner: {
      run: async <T>(work: (tx: any) => Promise<T>) => work(fakeTx),
    },
    carRepository: {
      getById: async (id: string) => mockCars.get(id) ?? null,
      getByPlateNumber: async (plate: string) => mockCars.get(plate.toUpperCase().replace(/[^A-Z0-9]/g, '')) ?? null,
      create: async (car: any) => {
        mockCars.set(car.id, car);
      },
      update: async (id: string, updates: any) => {
        mockCars.set(id, { ...mockCars.get(id), ...updates });
      },
      addAuditLog: async () => {},
      generateId: () => 'id-1',
    },
    userRepository: {
      getById: async (uid: string) => mockUsers.get(uid) ?? null,
    },
    fineRepository: {
      hasUnpaidFines: async () => false,
    },
  };
});

import { approveTransfer } from '../../src/infrastructure/entry-points/car/approve-transfer';
import { acknowledgeTransfer } from '../../src/infrastructure/entry-points/car/acknowledge-transfer';
import { rejectTransfer } from '../../src/infrastructure/entry-points/car/reject-transfer';
import { requestOwnershipTransfer } from '../../src/infrastructure/entry-points/car/request-ownership-transfer';

describe('US1: Error Mapping & Identity Payload Precedence', () => {
  beforeEach(() => {
    mockCars.clear();
    mockUsers.clear();
    mockUsers.set('owner-a', { uid: 'owner-a', role: 'owner' });
    mockUsers.set('owner-b', { uid: 'owner-b', role: 'owner' });
    mockUsers.set('police-1', { uid: 'police-1', role: 'police' });
  });

  it('maps every DomainErrorCode to the expected Firebase HttpsError code', () => {
    expect(mapDomainErrorToHttpsError(new DomainError('PERMISSION_DENIED', 'nope'))).toMatchObject({ code: 'permission-denied', message: 'nope' });
    expect(mapDomainErrorToHttpsError(new DomainError('INVALID_ARGUMENT', 'bad'))).toMatchObject({ code: 'invalid-argument', message: 'bad' });
    expect(mapDomainErrorToHttpsError(new DomainError('NOT_FOUND', 'missing'))).toMatchObject({ code: 'not-found', message: 'missing' });
    expect(mapDomainErrorToHttpsError(new DomainError('FAILED_PRECONDITION', 'state'))).toMatchObject({ code: 'failed-precondition', message: 'state' });
    expect(mapDomainErrorToHttpsError(new DomainError('ALREADY_EXISTS', 'dup'))).toMatchObject({ code: 'already-exists', message: 'dup' });
  });

  it('preserves HttpsError instances and maps unknown errors to internal', () => {
    const existing = new HttpsError('unauthenticated', 'Sign in');
    expect(mapDomainErrorToHttpsError(existing)).toBe(existing);
    expect(mapDomainErrorToHttpsError(new Error('boom'))).toMatchObject({ code: 'internal', message: 'boom' });
  });

  it('prevents spoofing actorId/ownerId/receiverId via request.data spread in entry points', async () => {
    mockCars.set('AB123CD', {
      id: 'AB123CD',
      ownerId: 'owner-a',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      status: 'transfer_pending_owner',
      transferToOwnerId: 'owner-b',
      transferCarteGriseUrl: 'transfers/owner-b/doc.pdf',
    });

    await expect(
      acknowledgeTransfer.run({
        auth: { uid: 'owner-b' },
        data: { carId: 'AB123CD', ownerId: 'owner-a' },
      } as any)
    ).rejects.toMatchObject({ code: 'permission-denied' });

    await expect(
      rejectTransfer.run({
        auth: { uid: 'owner-b' },
        data: { carId: 'AB123CD', actorId: 'owner-a', reason: 'Spoof attempt' },
      } as any)
    ).rejects.toMatchObject({ code: 'permission-denied' });

    mockCars.get('AB123CD').status = 'transfer_pending_police';
    await expect(
      approveTransfer.run({
        auth: { uid: 'owner-b' },
        data: { carId: 'AB123CD', actorId: 'police-1' },
      } as any)
    ).rejects.toMatchObject({ code: 'permission-denied' });

    mockCars.get('AB123CD').status = 'active';
    await expect(
      requestOwnershipTransfer.run({
        auth: { uid: 'owner-b' },
        data: { plateNumber: 'AB-123-CD', receiverId: 'owner-a', carteGriseUrl: 'transfers/owner-b/doc.pdf' },
      } as any)
    ).resolves.toEqual({ ok: true });
    expect(mockCars.get('AB123CD').transferToOwnerId).toBe('owner-b');
  });
});
