import { CarRepository } from '../../../domain/repositories/car.repository';
import { Car, CarAuditLog } from '../../../domain/entities/car.entity';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';

export class FirestoreCarRepository implements CarRepository {
  constructor(private readonly connector: FirestoreConnector) { }

  async create(car: Car): Promise<void> {
    await this.connector.db.collection('cars').doc(car.id).set({
      ...car,
      createdAt: this.connector.getFieldValue().serverTimestamp(),
    });
  }

  async getById(id: string): Promise<Car | null> {
    const doc = await this.connector.db.collection('cars').doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as Car;
  }

  async update(id: string, updates: Partial<Car>): Promise<void> {
    const firestoreUpdates: any = { ...updates };

    Object.keys(firestoreUpdates).forEach(key => {
      if (firestoreUpdates[key] === null) {
        firestoreUpdates[key] = this.connector.getFieldValue().delete();
      }
    });

    firestoreUpdates.updatedAt = this.connector.getFieldValue().serverTimestamp();

    await this.connector.db.collection('cars').doc(id).update(firestoreUpdates);
  }

  async addAuditLog(log: Omit<CarAuditLog, 'id'>): Promise<void> {
    await this.connector.db.collection('car_audit_logs').add({
      ...log,
      timestamp: this.connector.getFieldValue().serverTimestamp(),
    });
  }

  generateId(): string {
    return this.connector.db.collection('cars').doc().id;
  }
}
