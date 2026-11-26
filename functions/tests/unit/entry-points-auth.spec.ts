import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { DomainError } from '../../src/domain/errors/domain.error';
import { mapDomainErrorToHttpsError } from '../../src/infrastructure/entry-points/shared/error-mapper';

const mockCars = new Map<string, any>();
const mockUsers = new Map<string, any>();
const mockReports = new Map<string, any>();
const mockAudits: any[] = [];

vi.mock('../../src/infrastructure/entry-points/index', () => {
  const fakeTx = {} as any;
  return {
    transactionRunner: {
      run: async <T>(work: (tx: any) => Promise<T>) => work(fakeTx),
    },
    carRepository: {
      getById: async (id: string) => mockCars.get(id) ?? null,
      getByPlateNumber: async (plate: string) => mockCars.get(plate.toUpperCase().replace(/[^A-Z0-9]/g, '')) ?? null,
      getAllByPlateNumber: async (plate: string) => {
        const key = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return mockCars.has(key) ? [mockCars.get(key)] : [];
      },
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
      save: async (user: any) => {
        mockUsers.set(user.uid, { ...(mockUsers.get(user.uid) ?? {}), ...user });
      },
      update: async (uid: string, updates: any) => {
        mockUsers.set(uid, { ...(mockUsers.get(uid) ?? {}), ...updates });
      },
    },
    reportRepository: {
      create: async () => 'rep-1',
      getById: async (id: string) => mockReports.get(id) ?? null,
      updateStatus: async (id: string, status: string) => {
        mockReports.set(id, { ...mockReports.get(id), status });
      },
      update: async (id: string, updates: any) => {
        mockReports.set(id, { ...mockReports.get(id), ...updates });
      },
    },
    enforcementAuditPort: {
      addAuditLog: async (log: any) => {
        mockAudits.push(log);
      },
    },
    policeAuditPort: {
      addLog: async () => {},
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
import { setUserRole } from '../../src/infrastructure/entry-points/user/set-user-role';
import { updateUserProfile } from '../../src/infrastructure/entry-points/user/update-user-profile';
import { dismissReport } from '../../src/infrastructure/entry-points/report/dismiss-report';

describe('US1: Error Mapping & Identity Payload Precedence', () => {
  beforeEach(() => {
    mockCars.clear();
    mockUsers.clear();
    mockReports.clear();
    mockAudits.length = 0;
    mockUsers.set('owner-a', { uid: 'owner-a', roles: ['owner'] });
    mockUsers.set('owner-b', { uid: 'owner-b', roles: ['owner'] });
    mockUsers.set('police-1', { uid: 'police-1', roles: ['police', 'owner'] });
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

  it('enforces unauthenticated checks and domain error mapping on setUserRole, updateUserProfile, and dismissReport', async () => {
    await expect(setUserRole.run({ auth: null, data: { role: 'owner' } } as any)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(
      setUserRole.run({ auth: { uid: 'owner-a', token: {} }, data: { role: 'police' } } as any)
    ).rejects.toMatchObject({ code: 'already-exists' });

    await expect(updateUserProfile.run({ auth: null, data: {} } as any)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(
      updateUserProfile.run({ auth: { uid: 'owner-a' }, data: { roles: ['police', 'owner'] } } as any)
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    await expect(
      updateUserProfile.run({ auth: { uid: 'owner-a' }, data: { uid: 'owner-b', fullName: 'Real Owner A' } } as any)
    ).resolves.toEqual({ ok: true });
    expect(mockUsers.get('owner-a')?.fullName).toBe('Real Owner A');
    expect(mockUsers.get('owner-b')?.fullName).toBeUndefined();

    mockReports.set('rep-1', { id: 'rep-1', plateNumber: 'AB-123-CD', status: 'pending' });
    mockCars.set('AB123CD', { id: 'AB123CD', ownerId: 'police-1', plateNumber: 'AB-123-CD', status: 'active' });
    await expect(
      dismissReport.run({ auth: { uid: 'police-1' }, data: { reportId: 'rep-1', reason: 'Blurry plate' } } as any)
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
