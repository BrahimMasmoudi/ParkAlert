import { Car, CarAuditLog } from '../entities/car.entity';
import { TransactionContext } from './transaction.port';

export interface CarRepository {
  create(car: Car, tx?: TransactionContext): Promise<void>;
  getById(id: string, tx?: TransactionContext): Promise<Car | null>;
  getByPlateNumber(plateNumber: string, tx?: TransactionContext): Promise<Car | null>;
  update(id: string, updates: Partial<Car>, tx?: TransactionContext): Promise<void>;
  addAuditLog(log: Omit<CarAuditLog, 'id'>, tx?: TransactionContext): Promise<void>;
  generateId(): string;
}
