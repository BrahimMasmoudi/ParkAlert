import { FineRepository } from '../../../domain/repositories/fine.repository';
import { Fine } from '../../../domain/entities/fine.entity';
import { TransactionContext } from '../../../domain/repositories/transaction.port';
import { normalizePlate } from '../../../domain/value-objects/plate';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';
import { asFirestoreTransaction } from './FirestoreTransactionRunner';

export class FirestoreFineRepository implements FineRepository {
  constructor(private readonly connector: FirestoreConnector) {}

  async create(fine: Omit<Fine, 'id'>, txOrBatch?: TransactionContext | any): Promise<string> {
    const coll = this.connector.db.collection('fines');
    const data = {
      ...fine,
      plateNumberNormalized: fine.plateNumberNormalized || normalizePlate(fine.plateNumber),
      issuedAt: this.connector.getFieldValue().serverTimestamp(),
    };
    if (txOrBatch) {
      const ref = coll.doc();
      txOrBatch.set(ref, data);
      return ref.id;
    }
    const ref = await coll.add(data);
    return ref.id;
  }

  async getById(id: string, tx?: TransactionContext): Promise<Fine | null> {
    const ref = this.connector.db.collection('fines').doc(id);
    const firestoreTx = asFirestoreTransaction(tx);
    const doc = firestoreTx ? await firestoreTx.get(ref) : await ref.get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Fine;
  }

  async update(id: string, updates: Partial<Fine>, txOrBatch?: TransactionContext | any): Promise<void> {
    const ref = this.connector.db.collection('fines').doc(id);
    const firestoreUpdates = {
      ...updates,
      ...(updates.status === 'paid' ? { paidAt: this.connector.getFieldValue().serverTimestamp() } : {}),
    };

    if (txOrBatch) {
      txOrBatch.update(ref, firestoreUpdates);
    } else {
      await ref.update(firestoreUpdates);
    }
  }

  async hasUnpaidFines(ownerId: string, plateNumber: string, tx?: TransactionContext): Promise<boolean> {
    const normalized = normalizePlate(plateNumber);
    const unpaidQuery = this.connector.db
      .collection('fines')
      .where('ownerId', '==', ownerId)
      .where('plateNumberNormalized', '==', normalized)
      .where('status', '==', 'unpaid')
      .limit(1);

    const firestoreTx = asFirestoreTransaction(tx);
    const snapshot = firestoreTx ? await firestoreTx.get(unpaidQuery) : await unpaidQuery.get();
    return !snapshot.empty;
  }
}
