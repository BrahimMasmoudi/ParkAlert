import { PoliceAuditLog } from '../../../domain/entities/police-audit.entity';
import { PoliceAuditPort } from '../../../domain/repositories/police-audit.port';
import { TransactionContext } from '../../../domain/repositories/transaction.port';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';
import { asFirestoreTransaction } from './FirestoreTransactionRunner';

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        clean[key] = stripUndefinedDeep(val);
      }
    }
    return clean as T;
  }
  return value;
}

/**
 * Persistence adapter writing immutable unified police decision logs inside Firestore transactions.
 */
export class PoliceAuditHelper implements PoliceAuditPort {
  constructor(private readonly connector: FirestoreConnector) {}

  async addLog(
    entry: Omit<PoliceAuditLog, 'id' | 'timestamp'>,
    tx: TransactionContext
  ): Promise<void> {
    const firestoreTx = asFirestoreTransaction(tx);
    if (typeof firestoreTx?.create !== 'function') {
      throw new Error('PoliceAuditHelper.addLog requires an active Firestore transaction');
    }

    const rawPayload = { ...(entry as Record<string, unknown>) };
    delete rawPayload.id;
    const cleanPayload = stripUndefinedDeep(rawPayload);
    const data = {
      ...cleanPayload,
      timestamp: this.connector.getFieldValue().serverTimestamp(),
    };

    const ref = this.connector.db.collection('police_audit_logs').doc();
    firestoreTx.create(ref, data);
  }
}
