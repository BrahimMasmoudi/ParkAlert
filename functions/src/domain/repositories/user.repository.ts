import { User } from '../entities/user.entity';

export interface UserRepository {
  getById(uid: string): Promise<User | null>;
  save(user: Partial<User>): Promise<void>;
  update(uid: string, updates: Partial<User>): Promise<void>;
}
