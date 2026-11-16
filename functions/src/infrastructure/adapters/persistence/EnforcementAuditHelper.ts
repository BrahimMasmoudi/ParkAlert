import { EnforcementAuditLog } from '../../../domain/entities/report.entity';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionContext } from '../../../domain/repositories/transaction.port';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';
import { asFirestoreTransaction } from './FirestoreTransactionRunner';

/**
 * Shared persistence adapter writing immutable enforcement audit logs to Firestore.
 */
export class EnforcementAuditHelper implements EnforcementAuditPort {
  constructor(private readonly connector: FirestoreConnector) {}

  async addAuditLog(
    entry: Omit<EnforcementAuditLog, 'id'>,
    txOrBatch?: TransactionContext | any
  ): Promise<void> {
    const ref = this.connector.db.collection('enforcement_audit_logs').doc();
    const data = {
      ...entry,
      timestamp: this.connector.getFieldValue().serverTimestamp(),
    };

    const firestoreTx = asFirestoreTransaction(txOrBatch);
    if (firestoreTx) {
      firestoreTx.create(ref, data);
    } else if (txOrBatch && typeof txOrBatch.set === 'function') {
      txOrBatch.set(ref, data);
    } else {
      await ref.set(data);
    }
  }
}
