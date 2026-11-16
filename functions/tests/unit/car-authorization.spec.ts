import { describe, expect, it } from 'vitest';
import { Car, CarAuditLog } from '../../src/domain/entities/car.entity';
import { Fine } from '../../src/domain/entities/fine.entity';
import { User } from '../../src/domain/entities/user.entity';
import { DomainError } from '../../src/domain/errors/domain.error';
import { CarRepository } from '../../src/domain/repositories/car.repository';
import { FineRepository } from '../../src/domain/repositories/fine.repository';
import { TransactionContext, TransactionRunner } from '../../src/domain/repositories/transaction.port';
import { UserRepository } from '../../src/domain/repositories/user.repository';
import { AcknowledgeTransferUseCase } from '../../src/application/usecases/car/acknowledge-transfer';
import { AddCarUseCase } from '../../src/application/usecases/car/add-car';
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
  { uid: 'owner-a', role: 'owner', name: 'Owner A', email: 'a@test.com', createdAt: new Date() },
  { uid: 'owner-b', role: 'owner', name: 'Owner B', email: 'b@test.com', createdAt: new Date() },
  { uid: 'agent-1', role: 'agent', name: 'Agent 1', email: 'ag@test.com', createdAt: new Date() },
  { uid: 'police-1', role: 'police', name: 'Police 1', email: 'p@test.com', createdAt: new Date() },
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

    const approveTransfer = new ApproveTransferUseCase(carRepo, fineRepo, userRepo, fakeRunner);
    const approveCar = new ApproveCarUseCase(carRepo, userRepo, fakeRunner);
    const rejectCar = new RejectCarUseCase(carRepo, userRepo, fakeRunner);

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
    const rejectTransfer = new RejectTransferUseCase(carRepo, userRepo, fakeRunner);

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
    const reqDel = new RequestCarDeletionUseCase(carRepo, userRepo, fakeRunner);
    const cancelDel = new CancelCarDeletionUseCase(carRepo, userRepo, fakeRunner);

    await expect(reqTransfer.execute({ plateNumber: 'AB-123-CD', receiverId: 'police-1', carteGriseUrl: 'transfers/police-1/a.pdf' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(ack.execute({ carId: 'AB123CD', ownerId: 'owner-b' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(checkPlate.execute({ plateNumber: 'AB-123-CD', callerId: 'agent-1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(reqDel.execute({ carId: 'AB123CD', userId: 'police-1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(cancelDel.execute({ carId: 'AB123CD', userId: 'agent-1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
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
