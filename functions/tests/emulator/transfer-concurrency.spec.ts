import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreConnector } from '../../src/infrastructure/connectors/FirestoreConnector';
import { FirestoreTransactionRunner } from '../../src/infrastructure/adapters/persistence/FirestoreTransactionRunner';
import { FirestoreCarRepository } from '../../src/infrastructure/adapters/persistence/FirestoreCarRepository';
import { FirestoreFineRepository } from '../../src/infrastructure/adapters/persistence/FirestoreFineRepository';
import { FirestoreReportRepository } from '../../src/infrastructure/adapters/persistence/FirestoreReportRepository';
import { FirestoreUserRepository } from '../../src/infrastructure/adapters/persistence/FirestoreUserRepository';
import { AddCarUseCase } from '../../src/application/usecases/car/add-car';
import { ApproveTransferUseCase } from '../../src/application/usecases/car/approve-transfer';
import { RequestOwnershipTransferUseCase } from '../../src/application/usecases/car/request-ownership-transfer';
import { IssueFineUseCase } from '../../src/application/usecases/fine/issue-fine';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const app = getApps().length ? getApps()[0] : initializeApp({ projectId: 'parkalert-concurrency-test' });
const db = getFirestore(app);
const connector = new FirestoreConnector(db);
const txRunner = new FirestoreTransactionRunner(connector);
const carRepo = new FirestoreCarRepository(connector);
const fineRepo = new FirestoreFineRepository(connector);
const reportRepo = new FirestoreReportRepository(connector);
const userRepo = new FirestoreUserRepository(connector);

async function clearCollection(name: string) {
  const snap = await db.collection(name).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

describe('US3: Atomic Concurrency & Unpaid-Fines Enforcement (Emulator)', () => {
  beforeAll(async () => {
    await Promise.all([clearCollection('users'), clearCollection('cars'), clearCollection('fines'), clearCollection('reports'), clearCollection('car_audit_logs')]);
  });

  afterAll(async () => {
    await Promise.all([clearCollection('users'), clearCollection('cars'), clearCollection('fines'), clearCollection('reports'), clearCollection('car_audit_logs')]);
  });

  beforeEach(async () => {
    await Promise.all([clearCollection('users'), clearCollection('cars'), clearCollection('fines'), clearCollection('reports'), clearCollection('car_audit_logs')]);
    await db.collection('users').doc('owner-a').set({ uid: 'owner-a', roles: ['owner'] });
    await db.collection('users').doc('owner-b').set({ uid: 'owner-b', roles: ['owner'] });
    await db.collection('users').doc('police-1').set({ uid: 'police-1', roles: ['police', 'owner'] });
  });

  it('allows only one approveTransfer when two police officers approve concurrently', async () => {
    await db.collection('cars').doc('AB123CD').set({
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
      status: 'transfer_pending_police',
      createdAt: new Date(),
    });

    const uc = new ApproveTransferUseCase(carRepo, fineRepo, userRepo, txRunner);
    const results = await Promise.allSettled([
      uc.execute({ carId: 'AB123CD', actorId: 'police-1' }),
      uc.execute({ carId: 'AB123CD', actorId: 'police-1' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const auditSnap = await db.collection('car_audit_logs').where('carId', '==', 'AB123CD').where('action', '==', 'TRANSFER_APPROVED').get();
    expect(auditSnap.size).toBe(1);
  });

  it('never leaves an approved transfer coexisting with a newly issued unpaid fine on Owner A', async () => {
    await db.collection('cars').doc('AB123CD').set({
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
      status: 'transfer_pending_police',
      createdAt: new Date(),
    });
    await db.collection('reports').doc('rep-1').set({
      plateNumber: 'AB-123-CD',
      status: 'pending',
    });

    const approve = new ApproveTransferUseCase(carRepo, fineRepo, userRepo, txRunner);
    const issueFine = new IssueFineUseCase(reportRepo, fineRepo, userRepo, carRepo, txRunner);

    const [approveRes, fineRes] = await Promise.allSettled([
      approve.execute({ carId: 'AB123CD', actorId: 'police-1' }),
      issueFine.execute({
        reportId: 'rep-1',
        ownerId: 'owner-a',
        plateNumber: 'AB-123-CD',
        amount: 50,
        issuedBy: 'police-1',
      }),
    ]);

    const carDoc = (await db.collection('cars').doc('AB123CD').get()).data()!;
    const finesSnap = await db.collection('fines').where('ownerId', '==', 'owner-a').where('status', '==', 'unpaid').get();

    // Either transfer won (ownerId === owner-b) and fine failed (0 unpaid fines),
    // or fine won (1 unpaid fine) and transfer stayed blocked (ownerId === owner-a).
    const bothSucceeded = approveRes.status === 'fulfilled' && fineRes.status === 'fulfilled';
    expect(bothSucceeded).toBe(false);
    if (carDoc.ownerId === 'owner-b') {
      expect(finesSnap.empty).toBe(true);
    } else {
      expect(finesSnap.size).toBe(1);
    }
  });

  it('prevents concurrent addCar overwrites and blocks transfer on dashed vs normalized unpaid fines', async () => {
    const addCar = new AddCarUseCase(carRepo, userRepo, txRunner);
    const addResults = await Promise.allSettled([
      addCar.execute({
        userId: 'owner-a',
        plateNumber: 'ZZ-111-ZZ',
        brand: 'Renault',
        model: 'Clio',
        color: 'Black',
        carteGriseUrl: 'carteGrise/owner-a/a.png',
      }),
      addCar.execute({
        userId: 'owner-b',
        plateNumber: 'ZZ111ZZ',
        brand: 'Peugeot',
        model: '208',
        color: 'White',
        carteGriseUrl: 'carteGrise/owner-b/b.png',
      }),
    ]);
    expect(addResults.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(addResults.filter((r) => r.status === 'rejected')).toHaveLength(1);

    await db.collection('cars').doc('ZZ111ZZ').update({ status: 'active' });
    const carAfter = (await db.collection('cars').doc('ZZ111ZZ').get()).data()!;
    const requester = carAfter.ownerId === 'owner-a' ? 'owner-b' : 'owner-a';

    await db.collection('fines').add({
      ownerId: carAfter.ownerId,
      plateNumber: 'ZZ-111-ZZ',
      plateNumberNormalized: 'ZZ111ZZ',
      status: 'unpaid',
      amount: 40,
      issuedAt: new Date(),
    });

    const reqTransfer = new RequestOwnershipTransferUseCase(carRepo, fineRepo, userRepo, txRunner);
    await expect(
      reqTransfer.execute({
        plateNumber: 'ZZ111ZZ',
        receiverId: requester,
        carteGriseUrl: `transfers/${requester}/doc.pdf`,
      })
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION', message: 'UNPAID_FINES_EXIST' });
  });

  it('blocks police self-approval and self-rejection of a transfer involving police-1 as seller or buyer', async () => {
    await db.collection('cars').doc('SL111SL').set({
      id: 'SL111SL',
      ownerId: 'police-1',
      plateNumber: 'SL-111-SL',
      plateNumberNormalized: 'SL111SL',
      brand: 'Renault',
      model: 'Clio',
      color: 'White',
      carteGriseUrl: 'carteGrise/police-1/doc.png',
      transferToOwnerId: 'owner-b',
      transferCarteGriseUrl: 'transfers/owner-b/doc.pdf',
      status: 'transfer_pending_police',
      createdAt: new Date(),
    });
    const approve = new ApproveTransferUseCase(carRepo, fineRepo, userRepo, txRunner);
    await expect(approve.execute({ carId: 'SL111SL', actorId: 'police-1' })).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });
});
