import { User } from '../entities/user.entity';
import { TransactionContext } from './transaction.port';

export interface UserRepository {
  getById(uid: string, tx?: TransactionContext): Promise<User | null>;
  save(user: Partial<User>): Promise<void>;
  update(uid: string, updates: Partial<User>): Promise<void>;
}
