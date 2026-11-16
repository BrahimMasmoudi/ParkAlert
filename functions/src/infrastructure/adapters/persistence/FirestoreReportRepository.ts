import { ReportRepository } from '../../../domain/repositories/report.repository';
import { Report } from '../../../domain/entities/report.entity';
import { TransactionContext } from '../../../domain/repositories/transaction.port';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';
import { asFirestoreTransaction } from './FirestoreTransactionRunner';

export class FirestoreReportRepository implements ReportRepository {
  constructor(private readonly connector: FirestoreConnector) {}

  async create(report: Omit<Report, 'id'>): Promise<string> {
    const ref = await this.connector.db.collection('reports').add({
      ...report,
      timestamp: this.connector.getFieldValue().serverTimestamp(),
    });
    return ref.id;
  }

  async getById(id: string, tx?: TransactionContext): Promise<Report | null> {
    const ref = this.connector.db.collection('reports').doc(id);
    const firestoreTx = asFirestoreTransaction(tx);
    const doc = firestoreTx ? await firestoreTx.get(ref) : await ref.get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Report;
  }

  async updateStatus(id: string, status: Report['status'], txOrBatch?: TransactionContext | any): Promise<void> {
    await this.update(id, { status }, txOrBatch);
  }

  async update(id: string, updates: Partial<Report>, txOrBatch?: TransactionContext | any): Promise<void> {
    const ref = this.connector.db.collection('reports').doc(id);
    const serverTime = this.connector.getFieldValue().serverTimestamp();
    const firestoreUpdates: Record<string, any> = {
      ...updates,
      ...(updates.plateCorrectedAt !== undefined ? { plateCorrectedAt: serverTime } : {}),
      ...(updates.resolvedAt !== undefined ? { resolvedAt: serverTime } : {}),
    };

    const firestoreTx = asFirestoreTransaction(txOrBatch);
    if (firestoreTx) {
      firestoreTx.update(ref, firestoreUpdates);
    } else if (txOrBatch && typeof txOrBatch.update === 'function') {
      txOrBatch.update(ref, firestoreUpdates);
    } else {
      await ref.update(firestoreUpdates);
    }
  }
}
