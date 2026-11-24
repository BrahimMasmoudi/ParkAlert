import { Fine, FineReceiptSummary } from '../entities/fine.entity';
import { TransactionContext } from './transaction.port';

export interface FineRepository {
  create(fine: Omit<Fine, 'id'>, txOrBatch?: TransactionContext | any): Promise<string>;
  getById(id: string, tx?: TransactionContext): Promise<Fine | null>;
  update(id: string, updates: Partial<Fine>, txOrBatch?: TransactionContext | any): Promise<void>;
  setReceiptSummary(
    fineId: string,
    receipt: FineReceiptSummary,
    txOrBatch?: TransactionContext | any
  ): Promise<void>;
  hasUnpaidFines(ownerId: string, plateNumber: string, tx?: TransactionContext): Promise<boolean>;
}
