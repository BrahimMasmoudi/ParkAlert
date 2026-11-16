import { EnforcementAuditLog } from '../entities/report.entity';
import { TransactionContext } from './transaction.port';

/**
 * Port for writing immutable audit entries for report and fine lifecycle transitions.
 */
export interface EnforcementAuditPort {
  addAuditLog(entry: Omit<EnforcementAuditLog, 'id'>, txOrBatch?: TransactionContext | any): Promise<void>;
}
