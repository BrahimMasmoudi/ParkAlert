import { Report } from '../entities/report.entity';
import { TransactionContext } from './transaction.port';

export interface ReportRepository {
  create(report: Omit<Report, 'id'>): Promise<string>;
  getById(id: string, tx?: TransactionContext): Promise<Report | null>;
  updateStatus(id: string, status: Report['status'], txOrBatch?: TransactionContext | any): Promise<void>;
}
