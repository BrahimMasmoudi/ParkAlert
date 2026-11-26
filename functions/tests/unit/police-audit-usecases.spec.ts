import { describe, expect, it, vi } from 'vitest';
import { ApproveCarUseCase } from '../../src/application/usecases/car/approve-car';
import { RejectCarUseCase } from '../../src/application/usecases/car/reject-car';
import { ApproveCarDeletionUseCase } from '../../src/application/usecases/car/approve-car-deletion';
import { ApproveTransferUseCase } from '../../src/application/usecases/car/approve-transfer';
import { RejectTransferUseCase } from '../../src/application/usecases/car/reject-transfer';
import { DismissReportUseCase } from '../../src/application/usecases/report/dismiss-report';
import { Car, CarAuditLog } from '../../src/domain/entities/car.entity';
import { PoliceAuditLog } from '../../src/domain/entities/police-audit.entity';
import { User } from '../../src/domain/entities/user.entity';
import { CarRepository } from '../../src/domain/repositories/car.repository';
import { FineRepository } from '../../src/domain/repositories/fine.repository';
import { PoliceAuditPort } from '../../src/domain/repositories/police-audit.port';
import { TransactionContext, TransactionRunner } from '../../src/domain/repositories/transaction.port';
import { UserRepository } from '../../src/domain/repositories/user.repository';
import { PoliceAuditHelper } from '../../src/infrastructure/adapters/persistence/PoliceAuditHelper';

const fakeTx = {} as TransactionContext;
const fakeRunner: TransactionRunner = {
  run: async <T>(work: (tx: TransactionContext) => Promise<T>) => work(fakeTx),
};

function makeCarRepos(initialCar: Car, extraCars: Car[] = []) {
  const cars = new Map<string, Car>([[initialCar.id, { ...initialCar }], ...extraCars.map((c) => [c.id, { ...c }] as const)]);
  const logs: Array<{ carId: string; log: Omit<CarAuditLog, 'id' | 'timestamp'> }> = [];
  const policeLogs: Array<Omit<PoliceAuditLog, 'id' | 'timestamp'>> = [];

  const carRepo: CarRepository = {
    create: async () => undefined,
    getById: async (id) => {
      const found = cars.get(id);
      return found ? { ...found } : null;
    },
    getAllByPlateNumber: async (plate) =>
      [...cars.values()].filter((c) => c.plateNumberNormalized === plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()),
    getActiveByPlateNumber: async () => null,
    getByPlateNumber: async () => null,
    update: async (id, patch) => {
      const curr = cars.get(id);
      if (curr) cars.set(id, { ...curr, ...patch });
    },
    addAuditLog: async (carId, log) => {
      logs.push({ carId, log });
    },
  };

  const userRepo: UserRepository = {
    getById: async (uid): Promise<User | null> => {
      if (uid === 'police-1') return { uid, name: 'Officer', email: 'pol@gov.tn', roles: ['police', 'owner'] };
      return { uid, name: uid, email: `${uid}@example.com`, roles: ['owner'] };
    },
    create: async () => undefined,
    update: async () => undefined,
  };

  const fineRepo: FineRepository = {
    create: async () => 'fine-1',
    getById: async () => null,
    update: async () => undefined,
    hasUnpaidFines: async () => false,
  };

  const policeAuditPort: PoliceAuditPort = {
    addLog: async (entry) => {
      policeLogs.push(entry);
    },
  };

  return { cars, logs, policeLogs, carRepo, userRepo, fineRepo, policeAuditPort };
}

describe('PoliceAuditHelper', () => {
  it('throws when called without an active Firestore transaction', async () => {
    const helper = new PoliceAuditHelper({
      db: { collection: vi.fn() },
      getFieldValue: () => ({ serverTimestamp: vi.fn() }),
    } as any);

    await expect(
      helper.addLog(
        {
          action: 'CAR_APPROVED',
          targetType: 'car',
          targetId: 'AB123CD',
          plateNumber: 'AB-123-CD',
          plateNumberNormalized: 'AB123CD',
          actorId: 'police-1',
          ownerId: 'owner-1',
        },
        {} as TransactionContext
      )
    ).rejects.toThrow(/requires an active Firestore transaction/);
  });

  it('strips id and nested undefined keys, preserves null and FieldValue sentinels, and writes to police_audit_logs', async () => {
    const docRef = { id: 'auto-log-1' };
    const docFn = vi.fn(() => docRef);
    const collectionFn = vi.fn(() => ({ doc: docFn }));
    const serverTimestampSentinel = { _methodName: 'serverTimestamp' };
    const createMock = vi.fn();

    const helper = new PoliceAuditHelper({
      db: { collection: collectionFn },
      getFieldValue: () => ({ serverTimestamp: () => serverTimestampSentinel }),
    } as any);

    await helper.addLog(
      {
        id: 'spoofed-id',
        action: 'DISMISS_REPORT',
        targetType: 'report',
        targetId: 'rep-1',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        actorId: 'police-1',
        ownerId: '',
        reason: 'Blurry plate',
        note: undefined,
        metadata: {
          originalPlateNumber: undefined,
          extra: null,
        } as any,
      } as any,
      { create: createMock } as unknown as TransactionContext
    );

    expect(collectionFn).toHaveBeenCalledWith('police_audit_logs');
    expect(docFn).toHaveBeenCalledWith();
    expect(createMock).toHaveBeenCalledTimes(1);
    const [writtenRef, writtenData] = createMock.mock.calls[0]!;
    expect(writtenRef).toBe(docRef);
    expect(writtenData).toEqual({
      action: 'DISMISS_REPORT',
      targetType: 'report',
      targetId: 'rep-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      actorId: 'police-1',
      ownerId: '',
      reason: 'Blurry plate',
      metadata: { extra: null },
      timestamp: serverTimestampSentinel,
    });
    expect('id' in writtenData).toBe(false);
    expect('note' in writtenData).toBe(false);
    expect('originalPlateNumber' in writtenData.metadata).toBe(false);
  });
});

describe('Car police use cases -> police_audit_logs', () => {
  const baseCar: Car = {
    id: 'AB123CD',
    plateNumber: 'AB-123-CD',
    plateNumberNormalized: 'AB123CD',
    ownerId: 'owner-a',
    model: 'Clio',
    color: 'White',
    carteGriseUrl: 'cars/owner-a/doc.pdf',
    status: 'activation_pending',
  };

  it('emits CAR_APPROVED with reason null in ApproveCarUseCase', async () => {
    const { carRepo, userRepo, policeAuditPort, policeLogs } = makeCarRepos(baseCar);
    const uc = new ApproveCarUseCase(carRepo, userRepo, fakeRunner, policeAuditPort);
    await uc.execute({ carId: 'AB123CD', actorId: 'police-1' });

    expect(policeLogs).toEqual([
      {
        action: 'CAR_APPROVED',
        targetType: 'car',
        targetId: 'AB123CD',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        actorId: 'police-1',
        ownerId: 'owner-a',
        reason: null,
      },
    ]);
  });

  it('emits CAR_REJECTED with reason in RejectCarUseCase', async () => {
    const { carRepo, userRepo, policeAuditPort, policeLogs } = makeCarRepos(baseCar);
    const uc = new RejectCarUseCase(carRepo, userRepo, fakeRunner, policeAuditPort);
    await uc.execute({ carId: 'AB123CD', actorId: 'police-1', reason: 'Unreadable carte grise' });

    expect(policeLogs).toEqual([
      {
        action: 'CAR_REJECTED',
        targetType: 'car',
        targetId: 'AB123CD',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        actorId: 'police-1',
        ownerId: 'owner-a',
        reason: 'Unreadable carte grise',
      },
    ]);
  });

  it('emits CAR_DELETION_APPROVED in ApproveCarDeletionUseCase', async () => {
    const { carRepo, fineRepo, userRepo, policeAuditPort, policeLogs } = makeCarRepos({
      ...baseCar,
      status: 'deletion_requested',
    });
    const uc = new ApproveCarDeletionUseCase(carRepo, fineRepo, userRepo, fakeRunner, policeAuditPort);
    await uc.execute({ carId: 'AB123CD', actorId: 'police-1' });

    expect(policeLogs).toEqual([
      {
        action: 'CAR_DELETION_APPROVED',
        targetType: 'car',
        targetId: 'AB123CD',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        actorId: 'police-1',
        ownerId: 'owner-a',
        reason: null,
      },
    ]);
  });

  it('emits TRANSFER_APPROVED with new ownerId in ApproveTransferUseCase', async () => {
    const { carRepo, fineRepo, userRepo, policeAuditPort, policeLogs } = makeCarRepos({
      ...baseCar,
      status: 'transfer_pending_police',
      transferToOwnerId: 'owner-b',
      transferCarteGriseUrl: 'transfers/owner-b/doc.pdf',
    });
    const uc = new ApproveTransferUseCase(carRepo, fineRepo, userRepo, fakeRunner, policeAuditPort);
    await uc.execute({ carId: 'AB123CD', actorId: 'police-1' });

    expect(policeLogs).toEqual([
      {
        action: 'TRANSFER_APPROVED',
        targetType: 'car',
        targetId: 'AB123CD',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        actorId: 'police-1',
        ownerId: 'owner-b',
        reason: null,
      },
    ]);
  });

  it('emits TRANSFER_REJECTED only at police stage and skips owner cancellation in RejectTransferUseCase', async () => {
    const ownerStage = makeCarRepos({
      ...baseCar,
      status: 'transfer_pending_owner',
      transferToOwnerId: 'owner-b',
    });
    const rejOwner = new RejectTransferUseCase(ownerStage.carRepo, ownerStage.userRepo, fakeRunner, ownerStage.policeAuditPort);
    await rejOwner.execute({ carId: 'AB123CD', actorId: 'owner-a', reason: 'Changed mind' });
    expect(ownerStage.policeLogs).toHaveLength(0);

    const policeStage = makeCarRepos({
      ...baseCar,
      status: 'transfer_pending_police',
      transferToOwnerId: 'owner-b',
      transferCarteGriseUrl: 'transfers/owner-b/doc.pdf',
    });
    const rejPolice = new RejectTransferUseCase(policeStage.carRepo, policeStage.userRepo, fakeRunner, policeStage.policeAuditPort);
    await rejPolice.execute({ carId: 'AB123CD', actorId: 'police-1', reason: 'Forged transfer form' });
    expect(policeStage.policeLogs).toEqual([
      {
        action: 'TRANSFER_REJECTED',
        targetType: 'car',
        targetId: 'AB123CD',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        actorId: 'police-1',
        ownerId: 'owner-a',
        reason: 'Forged transfer form',
      },
    ]);
  });
});

describe('DismissReportUseCase -> police_audit_logs', () => {
  it('prefers active car ownerId over pending car ownerId, ignores archived/rejected, deduplicates normalized plates, skips empty plate lookup, and reads before writing', async () => {
    const callOrder: string[] = [];

    const reportRepository = {
      create: vi.fn(),
      getById: vi.fn(async (id: string) => {
        if (id === 'rep-active') return { id, plateNumber: 'AB-123-CD', originalPlateNumber: 'ab 123 cd', status: 'pending' };
        if (id === 'rep-pending') return { id, plateNumber: 'CD-456-EF', status: 'pending' };
        if (id === 'rep-archived') return { id, plateNumber: 'EF-789-GH', status: 'pending' };
        if (id === 'rep-empty') return { id, plateNumber: '---', status: 'pending' };
        return null;
      }),
      updateStatus: vi.fn(),
      update: vi.fn(async () => {
        callOrder.push('report.update');
      }),
    };
    const userRepository = {
      getById: vi.fn().mockResolvedValue({ id: 'pol-1', roles: ['police', 'owner'] }),
      update: vi.fn(),
    };
    const carRepository = {
      getAllByPlateNumber: vi.fn(async (plate: string) => {
        callOrder.push(`car.getAll:${plate}`);
        if (plate === 'AB-123-CD') {
          return [
            { id: '1', ownerId: 'owner-pending', status: 'deletion_requested' },
            { id: '2', ownerId: 'owner-active', status: 'active' },
          ];
        }
        if (plate === 'CD-456-EF') {
          return [
            { id: '3', ownerId: 'owner-arch', status: 'archived' },
            { id: '4', ownerId: 'owner-pend', status: 'activation_pending' },
          ];
        }
        if (plate === 'EF-789-GH') {
          return [
            { id: '5', ownerId: 'owner-arch', status: 'archived' },
            { id: '6', ownerId: 'owner-rej', status: 'rejected' },
          ];
        }
        return [];
      }),
    };
    const enforcementAuditPort = {
      addAuditLog: vi.fn(async () => {
        callOrder.push('enforcementAudit.addAuditLog');
      }),
    };
    const policeAuditPort = {
      addLog: vi.fn(async () => {
        callOrder.push('policeAudit.addLog');
      }),
    };

    const uc = new DismissReportUseCase(
      reportRepository as any,
      userRepository as any,
      enforcementAuditPort,
      fakeRunner,
      carRepository as any,
      policeAuditPort
    );

    // 1. Active over pending + normalized dedup ('AB-123-CD' and 'ab 123 cd' -> 1 lookup) + read-before-write
    await uc.execute({ reportId: 'rep-active', reason: 'Duplicate alert', actorId: 'pol-1' });
    expect(carRepository.getAllByPlateNumber).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual([
      'car.getAll:AB-123-CD',
      'report.update',
      'enforcementAudit.addAuditLog',
      'policeAudit.addLog',
    ]);
    expect(policeAuditPort.addLog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'DISMISS_REPORT',
        targetType: 'report',
        targetId: 'rep-active',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        actorId: 'pol-1',
        ownerId: 'owner-active',
        reason: 'Duplicate alert',
      }),
      fakeTx
    );

    // 2. Pending fallback when no active vehicle
    await uc.execute({ reportId: 'rep-pending', reason: 'Invalid frame', actorId: 'pol-1' });
    expect(policeAuditPort.addLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetId: 'rep-pending', ownerId: 'owner-pend' }),
      fakeTx
    );

    // 3. Excluded archived/rejected -> ownerId: ''
    await uc.execute({ reportId: 'rep-archived', reason: 'Invalid frame', actorId: 'pol-1' });
    expect(policeAuditPort.addLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetId: 'rep-archived', ownerId: '' }),
      fakeTx
    );

    // 4. Empty normalized plate guard -> no getAllByPlateNumber lookup
    carRepository.getAllByPlateNumber.mockClear();
    await uc.execute({ reportId: 'rep-empty', reason: 'Empty plate', actorId: 'pol-1' });
    expect(carRepository.getAllByPlateNumber).not.toHaveBeenCalled();
    expect(policeAuditPort.addLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetId: 'rep-empty', ownerId: '', plateNumberNormalized: '' }),
      fakeTx
    );
  });
});
