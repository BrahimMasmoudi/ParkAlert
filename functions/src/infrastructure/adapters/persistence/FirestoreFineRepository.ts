import { FineRepository } from '../../../domain/repositories/fine.repository';
import { Fine } from '../../../domain/entities/fine.entity';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';

export class FirestoreFineRepository implements FineRepository {
  constructor(private readonly connector: FirestoreConnector) { }

  async create(fine: Omit<Fine, 'id'>, batch?: any): Promise<string> {
    const coll = this.connector.db.collection('fines');
    if (batch) {
      const ref = coll.doc();
      batch.set(ref, {
        ...fine,
        issuedAt: this.connector.getFieldValue().serverTimestamp(),
      });
      return ref.id;
    } else {
      const ref = await coll.add({
        ...fine,
        issuedAt: this.connector.getFieldValue().serverTimestamp(),
      });
      return ref.id;
    }
  }

  async getById(id: string): Promise<Fine | null> {
    const doc = await this.connector.db.collection('fines').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Fine;
  }

  async update(id: string, updates: Partial<Fine>, batch?: any): Promise<void> {
    const ref = this.connector.db.collection('fines').doc(id);
    const firestoreUpdates = {
      ...updates,
      ...(updates.status === 'paid' ? { paidAt: this.connector.getFieldValue().serverTimestamp() } : {}),
    };

    if (batch) {
      batch.update(ref, firestoreUpdates);
    } else {
      await ref.update(firestoreUpdates);
    }
  }

  async hasUnpaidFines(ownerId: string, plateNumber: string): Promise<boolean> {
    const snapshot = await this.connector.db.collection('fines')
      .where('ownerId', '==', ownerId)
      .where('plateNumber', '==', plateNumber)
      .where('status', '==', 'unpaid')
      .get();
    return !snapshot.empty;
  }
}
