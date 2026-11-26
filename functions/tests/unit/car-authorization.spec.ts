import { describe, expect, it } from 'vitest';
import { Car, CarAuditLog } from '../../src/domain/entities/car.entity';
import { Fine } from '../../src/domain/entities/fine.entity';
import { User } from '../../src/domain/entities/user.entity';
import { DomainError } from '../../src/domain/errors/domain.error';
import { CarRepository } from '../../src/domain/repositories/car.repository';
import { FineRepository } from '../../src/domain/repositories/fine.repository';
import { PoliceAuditPort } from '../../src/domain/repositories/police-audit.port';
import { TransactionContext, TransactionRunner } from '../../src/domain/repositories/transaction.port';
import { UserRepository } from '../../src/domain/repositories/user.repository';
import { AcknowledgeTransferUseCase } from '../../src/application/usecases/car/acknowledge-transfer';
import { AddCarUseCase } from '../../src/application/usecases/car/add-car';
import { ApproveCarDeletionUseCase } from '../../src/application/usecases/car/approve-car-deletion';
import { ApproveCarUseCase } from '../../src/application/usecases/car/approve-car';
import { ApproveTransferUseCase } from '../../src/application/usecases/car/approve-transfer';
import { CancelCarDeletionUseCase } from '../../src/application/usecases/car/cancel-car-deletion';
import { CheckPlateAvailabilityUseCase } from '../../src/application/usecases/car/check-plate';
import { RejectCarUseCase } from '../../src/application/usecases/car/reject-car';
import { RejectTransferUseCase } from '../../src/application/usecases/car/reject-transfer';
import { RequestCarDeletionUseCase } from '../../src/application/usecases/car/request-car-deletion';
import { RequestOwnershipTransferUseCase } from '../../src/application/usecases/car/request-ownership-transfer';
import { RetryCarUseCase } from '../../src/application/usecases/car/retry-car';

const fakeTx = {} as TransactionContext;
const fakeRunner: TransactionRunner = {
  run: async <T>(work: (tx: TransactionContext) => Promise<T>) => work(fakeTx),
};
const fakePoliceAuditPort: PoliceAuditPort = {
  addLog: async () => undefined,
};

function makeRepos(seedCars: Car[] = [], seedUsers: User[] = []) {
  const cars = new Map<string, Car>(seedCars.map((c) => [c.id, { ...c }]));
  const users = new Map<string, User>(seedUsers.map((u) => [u.uid, { ...u }]));
  const audits: Omit<CarAuditLog, 'id'>[] = [];
  const fines: Fine[] = [];

  const carRepo: CarRepository = {
    async create(car) {
      if (cars.has(car.id)) throw new DomainError('ALREADY_EXISTS', 'Exists');
      cars.set(car.id, { ...car });
    },
    async getById(id) {
      const car = cars.get(id);
      return car ? { ...car } : null;
    },
    async getByPlateNumber(plate) {
      const norm = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cars.get(norm) ? { ...cars.get(norm)! } : null;
    },
    async getAllByPlateNumber(plate) {
      const norm = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return cars.get(norm) ? [{ ...cars.get(norm)! }] : [];
    },
    async update(id, updates) {
      const existing = cars.get(id);
      if (!existing) throw new DomainError('NOT_FOUND', 'Missing');
      cars.set(id, { ...existing, ...updates });
    },
    async addAuditLog(log) {
      audits.push(log);
    },
    generateId: () => 'generated-id',
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
      return 'fine-1';
    },
    async getById() {
      return null;
    },
    async update() {},
    async hasUnpaidFines(ownerId, plate) {
      const norm = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return fines.some((f) => f.ownerId === ownerId && f.plateNumberNormalized === norm && f.status === 'unpaid');
    },
  };

  return { cars, users, audits, fines, carRepo, userRepo, fineRepo };
}

const baseUsers: User[] = [
  { uid: 'owner-a', roles: ['owner'], name: 'Owner A', email: 'a@test.com', createdAt: new Date() },
  { uid: 'owner-b', roles: ['owner'], name: 'Owner B', email: 'b@test.com', createdAt: new Date() },
  { uid: 'agent-1', roles: ['agent', 'owner'], name: 'Agent 1', email: 'ag@test.com', createdAt: new Date() },
  { uid: 'police-1', roles: ['police', 'owner'], name: 'Police 1', email: 'p@test.com', createdAt: new Date() },
  { uid: 'no-roles', roles: [], name: 'No Roles', email: 'none@test.com', createdAt: new Date() },
];

const activeCar: Car = {
  id: 'AB123CD',
  ownerId: 'owner-a',
  plateNumber: 'AB-123-CD',
  plateNumberNormalized: 'AB123CD',
  brand: 'Renault',
  model: 'Clio',
  color: 'Black',
  carteGriseUrl: 'carteGrise/owner-a/doc.png',
  status: 'active',
  createdAt: new Date(),
};

describe('US1: Car & Transfer Authorization, Role Enforcement, and Field Whitelisting', () => {
  it('blocks non-police from approving transfers, approving cars, or rejecting cars', async () => {
    const { carRepo, userRepo, fineRepo } = makeRepos(
      [
        { ...activeCar, status: 'transfer_pending_police', transferToOwnerId: 'owner-b', transferCarteGriseUrl: 'transfers/owner-b/doc.pdf' },
        { ...activeCar, id: 'CD456EF', plateNumber: 'CD-456-EF', plateNumberNormalized: 'CD456EF', status: 'activation_pending' },
      ],
      baseUsers
    );

    const approveTransfer = new ApproveTransferUseCase(carRepo, fineRepo, userRepo, fakeRunner, fakePoliceAuditPort);
    const approveCar = new ApproveCarUseCase(carRepo, userRepo, fakeRunner, fakePoliceAuditPort);
    const rejectCar = new RejectCarUseCase(carRepo, userRepo, fakeRunner, fakePoliceAuditPort);

    for (const actorId of ['owner-a', 'owner-b', 'agent-1', 'unknown']) {
      await expect(approveTransfer.execute({ carId: 'AB123CD', actorId })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      await expect(approveCar.execute({ carId: 'CD456EF', actorId })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
      await expect(rejectCar.execute({ carId: 'CD456EF', actorId, reason: 'Blurry doc' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    }
  });

  it('enforces strictly stage-scoped rejection authority and 3..500 trimmed reason bounds', async () => {
    const { carRepo, userRepo } = makeRepos(
      [
        { ...activeCar, status: 'transfer_pending_owner', transferToOwnerId: 'owner-b', transferCarteGriseUrl: 'transfers/owner-b/doc.pdf' },
        { ...activeCar, id: 'CD456EF', plateNumber: 'CD-456-EF', plateNumberNormalized: 'CD456EF', status: 'transfer_pending_police', transferToOwnerId: 'owner-b', transferCarteGriseUrl: 'transfers/owner-b/doc.pdf' },
      ],
      baseUsers
    );
    const rejectTransfer = new RejectTransferUseCase(carRepo, userRepo, fakeRunner, fakePoliceAuditPort);

    // Owner stage: police, owner-b, agent denied
    await expect(rejectTransfer.execute({ carId: 'AB123CD', actorId: 'police-1', reason: 'Valid reason' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(rejectTransfer.execute({ carId: 'AB123CD', actorId: 'owner-b', reason: 'Valid reason' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    // Police stage: owner-a, owner-b, agent denied
    await expect(rejectTransfer.execute({ carId: 'CD456EF', actorId: 'owner-a', reason: 'Valid reason' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(rejectTransfer.execute({ carId: 'CD456EF', actorId: 'agent-1', reason: 'Valid reason' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    // Reason bounds
    await expect(rejectTransfer.execute({ carId: 'AB123CD', actorId: 'owner-a', reason: '  no ' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(rejectTransfer.execute({ carId: 'AB123CD', actorId: 'owner-a', reason: 'x'.repeat(501) })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('rejects non-owner roles on transfer request, acknowledge, checkPlate, and deletion endpoints', async () => {
    const { carRepo, userRepo, fineRepo } = makeRepos(
      [{ ...activeCar, status: 'transfer_pending_owner', transferToOwnerId: 'owner-b', transferCarteGriseUrl: 'transfers/owner-b/doc.pdf' }],
      baseUsers
    );
    const reqTransfer = new RequestOwnershipTransferUseCase(carRepo, fineRepo, userRepo, fakeRunner);
    const ack = new AcknowledgeTransferUseCase(carRepo, userRepo, fakeRunner);
    const checkPlate = new CheckPlateAvailabilityUseCase(carRepo, userRepo);
    const reqDel = new RequestCarDeletionUseCase(carRepo, fineRepo, userRepo, fakeRunner);
    const cancelDel = new CancelCarDeletionUseCase(carRepo, userRepo, fakeRunner);

    await expect(reqTransfer.execute({ plateNumber: 'AB-123-CD', receiverId: 'no-roles', carteGriseUrl: 'transfers/no-roles/a.pdf' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(ack.execute({ carId: 'AB123CD', ownerId: 'owner-b' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(checkPlate.execute({ plateNumber: 'AB-123-CD', callerId: 'no-roles' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(reqDel.execute({ carId: 'AB123CD', userId: 'police-1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(cancelDel.execute({ carId: 'AB123CD', userId: 'no-roles' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(reqDel.execute({ carId: 'AB123CD', userId: 'no-roles' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

    // Dual-role ['police', 'owner'] retains personal owner actions on non-self vehicles
    await expect(checkPlate.execute({ plateNumber: 'AB-123-CD', callerId: 'police-1' })).resolves.toMatchObject({
      available: false,
      reason: 'TRANSFER_IN_PROGRESS',
    });
  });

  it('blocks police self-enforcement on approveCar, rejectCar, approveCarDeletion, approveTransfer, and rejectTransfer', async () => {
    const { carRepo, userRepo, fineRepo } = makeRepos(
      [
        { ...activeCar, id: 'ACT01', ownerId: 'police-1', status: 'activation_pending' },
        { ...activeCar, id: 'DEL01', ownerId: 'police-1', status: 'deletion_requested' },
        { ...activeCar, id: 'TR1', ownerId: 'police-1', status: 'transfer_pending_police', transferToOwnerId: 'owner-b', transferCarteGriseUrl: 'transfers/owner-b/doc.pdf' },
        { ...activeCar, id: 'TR2', ownerId: 'owner-a', status: 'transfer_pending_police', transferToOwnerId: 'police-1', transferCarteGriseUrl: 'transfers/police-1/doc.pdf' },
      ],
      baseUsers
    );

    const approveCar = new ApproveCarUseCase(carRepo, userRepo, fakeRunner, fakePoliceAuditPort);
    const rejectCar = new RejectCarUseCase(carRepo, userRepo, fakeRunner, fakePoliceAuditPort);
    const approveDel = new ApproveCarDeletionUseCase(carRepo, fineRepo, userRepo, fakeRunner, fakePoliceAuditPort);
    const approveTransfer = new ApproveTransferUseCase(carRepo, fineRepo, userRepo, fakeRunner, fakePoliceAuditPort);
    const rejectTransfer = new RejectTransferUseCase(carRepo, userRepo, fakeRunner, fakePoliceAuditPort);

    await expect(approveCar.execute({ carId: 'ACT01', actorId: 'police-1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(rejectCar.execute({ carId: 'ACT01', actorId: 'police-1', reason: 'Self reject' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(approveDel.execute({ carId: 'DEL01', actorId: 'police-1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(approveTransfer.execute({ carId: 'TR1', actorId: 'police-1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(rejectTransfer.execute({ carId: 'TR1', actorId: 'police-1', reason: 'Seller self' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(approveTransfer.execute({ carId: 'TR2', actorId: 'police-1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(rejectTransfer.execute({ carId: 'TR2', actorId: 'police-1', reason: 'Buyer self' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('whitelists retryCar fields, locks plateNumber, and enforces scoped Storage paths on addCar/retryCar/transfer', async () => {
    const { cars, carRepo, userRepo, fineRepo } = makeRepos(
      [{ ...activeCar, status: 'rejected', rejectionReason: 'Blurry' }],
      baseUsers
    );
    const addCar = new AddCarUseCase(carRepo, userRepo, fakeRunner);
    const retryCar = new RetryCarUseCase(carRepo, userRepo, fakeRunner);
    const reqTransfer = new RequestOwnershipTransferUseCase(carRepo, fineRepo, userRepo, fakeRunner);

    // Invalid paths
    await expect(addCar.execute({
      userId: 'owner-a', plateNumber: 'ZZ-999-ZZ', brand: 'Peugeot', model: '208', color: 'Blue',
      carteGriseUrl: 'https://evil.example.com/file.png',
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(addCar.execute({
      userId: 'owner-a', plateNumber: 'ZZ-999-ZZ', brand: 'Peugeot', model: '208', color: 'Blue',
      carteGriseUrl: 'carteGrise/owner-b/../owner-a/file.png',
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    await expect(reqTransfer.execute({
      plateNumber: 'AB-123-CD', receiverId: 'owner-b', carteGriseUrl: 'carteGrise/owner-b/doc.png',
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    // retryCar plate change blocked
    await expect(retryCar.execute({
      carId: 'AB123CD', userId: 'owner-a', plateNumber: 'ZZ-999-ZZ', brand: 'Renault', model: 'Clio', color: 'Red',
      carteGriseUrl: 'carteGrise/owner-a/new.png',
    })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    // retryCar ignores injected protected fields
    await retryCar.execute({
      carId: 'AB123CD', userId: 'owner-a', brand: 'Renault', model: 'Megane', color: 'White',
      carteGriseUrl: 'carteGrise/owner-a/new.png',
      ...({ ownerId: 'owner-b', status: 'active', transferToOwnerId: 'owner-b' } as any),
    });

    const updated = cars.get('AB123CD')!;
    expect(updated.ownerId).toBe('owner-a');
    expect(updated.status).toBe('activation_pending');
    expect(updated.model).toBe('Megane');
    expect(updated.transferToOwnerId).toBeUndefined();
  });
});
