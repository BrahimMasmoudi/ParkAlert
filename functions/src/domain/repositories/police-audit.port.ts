import { PoliceAuditLog } from '../entities/police-audit.entity';
import { TransactionContext } from './transaction.port';

export interface PoliceAuditPort {
  addLog(entry: Omit<PoliceAuditLog, 'id' | 'timestamp'>, tx: TransactionContext): Promise<void>;
}
