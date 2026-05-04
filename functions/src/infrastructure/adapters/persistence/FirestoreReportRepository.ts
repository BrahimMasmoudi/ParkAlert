import { ReportRepository } from '../../../domain/repositories/report.repository';
import { Report } from '../../../domain/entities/report.entity';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';

export class FirestoreReportRepository implements ReportRepository {
  constructor(private readonly connector: FirestoreConnector) { }

  async create(report: Omit<Report, 'id'>): Promise<string> {
    const ref = await this.connector.db.collection('reports').add({
      ...report,
      timestamp: this.connector.getFieldValue().serverTimestamp(),
    });
    return ref.id;
  }

  async getById(id: string): Promise<Report | null> {
    const doc = await this.connector.db.collection('reports').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Report;
  }

  async updateStatus(id: string, status: Report['status'], batch?: any): Promise<void> {
    const ref = this.connector.db.collection('reports').doc(id);
    if (batch) {
      batch.update(ref, { status });
    } else {
      await ref.update({ status });
    }
  }
}
