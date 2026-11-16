/**
 * Opaque transaction token passed through domain repository ports.
 * Concrete persistence adapters interpret this token without exposing SDK types to domain/application layers.
 */
export interface TransactionContext {
  readonly __brand: 'TransactionContext';
}

/**
 * Port for executing an atomic unit of work across one or more repositories.
 */
export interface TransactionRunner {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
