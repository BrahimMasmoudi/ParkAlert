import { Fine } from '../entities/fine.entity';

export interface FineRepository {
  create(fine: Omit<Fine, 'id'>, batch?: any): Promise<string>;
  getById(id: string): Promise<Fine | null>;
  update(id: string, updates: Partial<Fine>, batch?: any): Promise<void>;
  hasUnpaidFines(ownerId: string, plateNumber: string): Promise<boolean>;
}
