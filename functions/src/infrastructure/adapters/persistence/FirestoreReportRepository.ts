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
    const ref = this.connector.db.collection('reports').doc(id);
    if (txOrBatch) {
      txOrBatch.update(ref, { status });
    } else {
      await ref.update({ status });
    }
  }
}
