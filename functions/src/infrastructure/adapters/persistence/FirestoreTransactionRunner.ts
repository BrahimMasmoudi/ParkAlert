import { Transaction } from 'firebase-admin/firestore';
import { TransactionContext, TransactionRunner } from '../../../domain/repositories/transaction.port';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';

/**
 * Executes pure application units of work inside an atomic Firestore transaction.
 */
export class FirestoreTransactionRunner implements TransactionRunner {
  constructor(private readonly connector: FirestoreConnector) {}

  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.connector.runTransaction((firestoreTx: Transaction) =>
      work(firestoreTx as unknown as TransactionContext)
    );
  }
}

export function asFirestoreTransaction(tx?: TransactionContext): Transaction | undefined {
  return tx as unknown as Transaction | undefined;
}
