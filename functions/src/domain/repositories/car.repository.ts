import { Car, CarAuditLog } from '../entities/car.entity';

export interface CarRepository {
  create(car: Car): Promise<void>;
  getById(id: string): Promise<Car | null>;
  update(id: string, updates: Partial<Car>): Promise<void>;
  addAuditLog(log: Omit<CarAuditLog, 'id'>): Promise<void>;
  generateId(): string;
}
