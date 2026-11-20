import { describe, expect, it } from 'vitest';
import { Car, CarAuditLog, CarStatus } from '../../src/domain/entities/car.entity';
import { User } from '../../src/domain/entities/user.entity';
import { DomainError } from '../../src/domain/errors/domain.error';
import { CarRepository } from '../../src/domain/repositories/car.repository';
import { FineRepository } from '../../src/domain/repositories/fine.repository';
import { TransactionContext, TransactionRunner } from '../../src/domain/repositories/transaction.port';
import { UserRepository } from '../../src/domain/repositories/user.repository';
import { AcknowledgeTransferUseCase } from '../../src/application/usecases/car/acknowledge-transfer';
import { ApproveTransferUseCase } from '../../src/application/usecases/car/approve-transfer';
import { CancelCarDeletionUseCase } from '../../src/application/usecases/car/cancel-car-deletion';
import { RejectTransferUseCase } from '../../src/application/usecases/car/reject-transfer';
import { RequestCarDeletionUseCase } from '../../src/application/usecases/car/request-car-deletion';
import { RequestOwnershipTransferUseCase } from '../../src/application/usecases/car/request-ownership-transfer';

const fakeTx = {} as TransactionContext;
const fakeRunner: TransactionRunner = {
  run: async <T>(work: (tx: TransactionContext) => Promise<T>) => work(fakeTx),
};

const ALL_STATUSES: CarStatus[] = [
  'activation_pending',
  'active',
  'rejected',
  'deletion_requested',
  'archived',
  'transfer_pending_owner',
  'transfer_pending_police',
];

function setup(initialStatus: CarStatus, overrides: Partial<Car> = {}) {
  const cars = new Map<string, Car>([
    [
      'AB123CD',
      {
        id: 'AB123CD',
        ownerId: 'owner-a',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        brand: 'Renault',
        model: 'Clio',
        color: 'Black',
        carteGriseUrl: 'carteGrise/owner-a/doc.png',
        status: initialStatus,
        createdAt: new Date(),
        ...overrides,
      },
    ],
  ]);

  const users = new Map<string, User>([
    ['owner-a', { uid: 'owner-a', roles: ['owner'], name: 'A', email: 'a@test.com', createdAt: new Date() }],
    ['owner-b', { uid: 'owner-b', roles: ['owner'], name: 'B', email: 'b@test.com', createdAt: new Date() }],
    ['police-1', { uid: 'police-1', roles: ['police', 'owner'], name: 'P', email: 'p@test.com', createdAt: new Date() }],
  ]);

  const audits: Omit<CarAuditLog, 'id'>[] = [];
  const carRepo: CarRepository = {
    async create(car) {
      cars.set(car.id, car);
    },
    async getById(id) {
      return cars.get(id) ? { ...cars.get(id)! } : null;
    },
    async getByPlateNumber() {
      return cars.get('AB123CD') ? { ...cars.get('AB123CD')! } : null;
    },
    async getAllByPlateNumber() {
      return cars.get('AB123CD') ? [{ ...cars.get('AB123CD')! }] : [];
    },
    async update(id, updates) {
      const next = { ...cars.get(id)!, ...updates };
      for (const k of Object.keys(next) as (keyof Car)[]) {
        if (next[k] === null) delete next[k];
      }
      cars.set(id, next);
    },
    async addAuditLog(log) {
      audits.push(log);
    },
    generateId: () => 'id',
  };

  const userRepo: UserRepository = {
    async getById(uid) {
      return users.get(uid) ?? null;
    },
    async save() {},
    async update() {},
  };

  const fineRepo: FineRepository = {
    async create() {
      return 'f1';
    },
    async getById() {
      return null;
    },
    async update() {},
    async hasUnpaidFines() {
      return false;
    },
  };

  return { cars, audits, carRepo, userRepo, fineRepo };
}

describe('US4: State Machine & Eligibility Matrix', () => {
  it('only allows initiating transfer from active status', async () => {
    for (const status of ALL_STATUSES) {
      const { carRepo, fineRepo, userRepo } = setup(status);
      const uc = new RequestOwnershipTransferUseCase(carRepo, fineRepo, userRepo, fakeRunner);
      const call = uc.execute({
        plateNumber: 'AB-123-CD',
        receiverId: 'owner-b',
        carteGriseUrl: 'transfers/owner-b/doc.pdf',
      });
      if (status === 'active') {
        await expect(call).resolves.toEqual({ ok: true });
      } else {
        await expect(call).rejects.toThrow(DomainError);
      }
    }
  });

  it('rejects approveTransfer when transferToOwnerId or transferCarteGriseUrl is missing and blocks replay', async () => {
    const missingRecipient = setup('transfer_pending_police', {
      transferCarteGriseUrl: 'transfers/owner-b/doc.pdf',
    });
    const approve1 = new ApproveTransferUseCase(
      missingRecipient.carRepo,
      missingRecipient.fineRepo,
      missingRecipient.userRepo,
      fakeRunner
    );
    await expect(approve1.execute({ carId: 'AB123CD', actorId: 'police-1' })).rejects.toMatchObject({
      code: 'FAILED_PRECONDITION',
    });

    const valid = setup('transfer_pending_police', {
      transferToOwnerId: 'owner-b',
      transferCarteGriseUrl: 'transfers/owner-b/doc.pdf',
    });
    const approve2 = new ApproveTransferUseCase(valid.carRepo, valid.fineRepo, valid.userRepo, fakeRunner);
    await expect(approve2.execute({ carId: 'AB123CD', actorId: 'police-1' })).resolves.toEqual({ ok: true });
    expect(valid.cars.get('AB123CD')?.ownerId).toBe('owner-b');
    expect(valid.cars.get('AB123CD')?.status).toBe('active');
    // Replay must fail
    await expect(approve2.execute({ carId: 'AB123CD', actorId: 'police-1' })).rejects.toMatchObject({
      code: 'FAILED_PRECONDITION',
    });
  });

  it('enforces valid acknowledgeTransfer and rejectTransfer source states', async () => {
    for (const status of ALL_STATUSES) {
      const s1 = setup(status);
      const ack = new AcknowledgeTransferUseCase(s1.carRepo, s1.userRepo, fakeRunner);
      if (status === 'transfer_pending_owner') {
        await expect(ack.execute({ carId: 'AB123CD', ownerId: 'owner-a' })).resolves.toEqual({ ok: true });
      } else {
        await expect(ack.execute({ carId: 'AB123CD', ownerId: 'owner-a' })).rejects.toMatchObject({
          code: 'FAILED_PRECONDITION',
        });
      }

      const s2 = setup(status);
      const rej = new RejectTransferUseCase(s2.carRepo, s2.userRepo, fakeRunner);
      const actorId = status === 'transfer_pending_police' ? 'police-1' : 'owner-a';
      if (status === 'transfer_pending_owner' || status === 'transfer_pending_police') {
        await expect(rej.execute({ carId: 'AB123CD', actorId, reason: 'Cancelled deal' })).resolves.toEqual({ ok: true });
      } else {
        await expect(rej.execute({ carId: 'AB123CD', actorId, reason: 'Cancelled deal' })).rejects.toMatchObject({
          code: 'FAILED_PRECONDITION',
        });
      }
    }
  });

  it('allows requestCarDeletion only from active/rejected and restores preDeletionStatus on cancel', async () => {
    for (const status of ALL_STATUSES) {
      const { cars, carRepo, userRepo, fineRepo } = setup(status);
      const reqDel = new RequestCarDeletionUseCase(carRepo, fineRepo, userRepo, fakeRunner);
      const cancelDel = new CancelCarDeletionUseCase(carRepo, userRepo, fakeRunner);
      const res = reqDel.execute({ carId: 'AB123CD', userId: 'owner-a' });
      if (status === 'active' || status === 'rejected') {
        await expect(res).resolves.toEqual({ ok: true });
        expect(cars.get('AB123CD')?.preDeletionStatus).toBe(status);
        await expect(cancelDel.execute({ carId: 'AB123CD', userId: 'owner-a' })).resolves.toEqual({ ok: true });
        expect(cars.get('AB123CD')?.status).toBe(status);
        expect(cars.get('AB123CD')?.preDeletionStatus).toBeUndefined();
      } else {
        await expect(res).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
      }
    }
  });
});
