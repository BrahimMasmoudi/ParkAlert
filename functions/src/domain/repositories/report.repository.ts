import { Report } from '../entities/report.entity';

export interface ReportRepository {
  create(report: Omit<Report, 'id'>): Promise<string>;
  getById(id: string): Promise<Report | null>;
  updateStatus(id: string, status: Report['status'], batch?: any): Promise<void>;
}
