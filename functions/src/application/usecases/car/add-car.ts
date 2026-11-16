import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { Car } from '../../../domain/entities/car.entity';
import { DomainError } from '../../../domain/errors/domain.error';
import { isValidRegistrationPath, normalizePlate } from '../../../domain/value-objects/plate';

export interface AddCarRequest {
  userId: string;
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  carteGriseUrl: string;
}

export class AddCarUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: AddCarRequest) {
    const { userId, plateNumber, brand, model, color, carteGriseUrl } = request;
    if (!plateNumber || !brand?.trim() || !model?.trim() || !color?.trim() || !carteGriseUrl) {
      throw new DomainError('INVALID_ARGUMENT', 'plateNumber, brand, model, color, and carteGriseUrl are required');
    }

    const formattedPlate = normalizePlate(plateNumber);
    if (!formattedPlate) {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid plateNumber');
    }

    if (!isValidRegistrationPath(carteGriseUrl, userId)) {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid registration document path');
    }

    return this.transactionRunner.run(async (tx) => {
      const user = await this.userRepository.getById(userId, tx);
      if (!user || user.role !== 'owner') {
        throw new DomainError('PERMISSION_DENIED', 'Only owners can add cars');
      }

      const existingCar = await this.carRepository.getById(formattedPlate, tx);
      if (existingCar) {
        if (existingCar.ownerId === userId) {
          throw new DomainError('ALREADY_EXISTS', 'You have already registered this vehicle');
        }
        throw new DomainError('ALREADY_EXISTS', 'VEHICLE_ALREADY_REGISTERED');
      }

      const car: Car = {
        id: formattedPlate,
        ownerId: userId,
        plateNumber: String(plateNumber).toUpperCase().trim(),
        plateNumberNormalized: formattedPlate,
        brand: brand.trim(),
        model: model.trim(),
        color: color.trim(),
        carteGriseUrl: carteGriseUrl.trim(),
        status: 'activation_pending',
        createdAt: new Date(),
      };

      await this.carRepository.create(car, tx);
      await this.carRepository.addAuditLog(
        {
          carId: formattedPlate,
          actorId: userId,
          action: 'CAR_REGISTERED',
          timestamp: new Date(),
        },
        tx
      );

      return { ok: true, carId: formattedPlate };
    });
  }
}
