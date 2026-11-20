import { CarRepository, PlateLookupOptions } from '../../../domain/repositories/car.repository';
import { Car, CarAuditLog } from '../../../domain/entities/car.entity';
import { TransactionContext } from '../../../domain/repositories/transaction.port';
import { normalizePlate } from '../../../domain/value-objects/plate';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';
import { asFirestoreTransaction } from './FirestoreTransactionRunner';

export class FirestoreCarRepository implements CarRepository {
  constructor(private readonly connector: FirestoreConnector) {}

  async create(car: Car, tx?: TransactionContext): Promise<void> {
    const ref = this.connector.db.collection('cars').doc(car.id);
    const data = {
      ...car,
      createdAt: this.connector.getFieldValue().serverTimestamp(),
    };
    const firestoreTx = asFirestoreTransaction(tx);
    if (firestoreTx) {
      firestoreTx.create(ref, data);
    } else {
      await ref.create(data);
    }
  }

  async getById(id: string, tx?: TransactionContext): Promise<Car | null> {
    const ref = this.connector.db.collection('cars').doc(id);
    const firestoreTx = asFirestoreTransaction(tx);
    const doc = firestoreTx ? await firestoreTx.get(ref) : await ref.get();
    if (!doc.exists) return null;
    return doc.data() as Car;
  }

  async getByPlateNumber(plateNumber: string, tx?: TransactionContext): Promise<Car | null> {
    const normalized = normalizePlate(plateNumber);
    const plateQuery = this.connector.db
      .collection('cars')
      .where('plateNumberNormalized', '==', normalized);
    const firestoreTx = asFirestoreTransaction(tx);
    const snapshot = firestoreTx ? await firestoreTx.get(plateQuery) : await plateQuery.get();

    const eligible = snapshot.docs
      .map((doc) => doc.data() as Car)
      .filter((car) => car.status !== 'archived' && car.status !== 'rejected');

    if (eligible.length > 0) {
      return eligible.find((car) => car.status === 'active') ?? eligible[0];
    }

    if (!snapshot.empty) {
      return null;
    }

    // Fallback to exact match on ID for legacy cars lacking plateNumberNormalized
    const fallbackCar = await this.getById(normalized, tx);
    if (!fallbackCar || fallbackCar.status === 'archived' || fallbackCar.status === 'rejected') {
      return null;
    }
    return fallbackCar;
  }

  async getAllByPlateNumber(
    plateNumber: string,
    tx?: TransactionContext,
    options?: PlateLookupOptions
  ): Promise<Car[]> {
    const normalized = normalizePlate(plateNumber);
    if (!normalized) return [];

    const plateQuery = this.connector.db
      .collection('cars')
      .where('plateNumberNormalized', '==', normalized);
    const firestoreTx = asFirestoreTransaction(tx);
    const snapshot = firestoreTx ? await firestoreTx.get(plateQuery) : await plateQuery.get();

    const matchesById = new Map<string, Car>();
    for (const doc of snapshot.docs) {
      const car = doc.data() as Car;
      const carId = car.id ?? doc.id;
      matchesById.set(carId, { ...car, id: carId });
    }

    const fallbackCar = await this.getById(normalized, tx);
    if (fallbackCar) {
      const fallbackId = fallbackCar.id ?? normalized;
      if (!matchesById.has(fallbackId)) {
        matchesById.set(fallbackId, { ...fallbackCar, id: fallbackId });
      }
    }

    return Array.from(matchesById.values()).filter((car) => {
      if (!options?.includeRejected && car.status === 'rejected') return false;
      if (!options?.includeArchived && car.status === 'archived') return false;
      return true;
    });
  }

  async update(id: string, updates: Partial<Car>, tx?: TransactionContext): Promise<void> {
    const firestoreUpdates: Record<string, any> = { ...updates };

    Object.keys(firestoreUpdates).forEach((key) => {
      if (firestoreUpdates[key] === null) {
        firestoreUpdates[key] = this.connector.getFieldValue().delete();
      }
    });

    firestoreUpdates.updatedAt = this.connector.getFieldValue().serverTimestamp();

    const ref = this.connector.db.collection('cars').doc(id);
    const firestoreTx = asFirestoreTransaction(tx);
    if (firestoreTx) {
      firestoreTx.update(ref, firestoreUpdates);
    } else {
      await ref.update(firestoreUpdates);
    }
  }

  async addAuditLog(log: Omit<CarAuditLog, 'id'>, tx?: TransactionContext): Promise<void> {
    const ref = this.connector.db.collection('car_audit_logs').doc();
    const data = {
      ...log,
      timestamp: this.connector.getFieldValue().serverTimestamp(),
    };
    const firestoreTx = asFirestoreTransaction(tx);
    if (firestoreTx) {
      firestoreTx.create(ref, data);
    } else {
      await ref.set(data);
    }
  }

  generateId(): string {
    return this.connector.db.collection('cars').doc().id;
  }
}
