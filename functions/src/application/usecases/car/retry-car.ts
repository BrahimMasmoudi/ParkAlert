import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { isValidRegistrationPath, normalizePlate } from '../../../domain/value-objects/plate';
import { assertHasRole } from '../shared/user-authorization';

export interface RetryCarRequest {
  carId: string;
  userId: string;
  plateNumber?: string;
  brand: string;
  model: string;
  color: string;
  carteGriseUrl: string;
}

export class RetryCarUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: RetryCarRequest) {
    const { carId, userId, plateNumber, brand, model, color, carteGriseUrl } = request;
    if (!carId || !userId || !brand?.trim() || !model?.trim() || !color?.trim() || !carteGriseUrl) {
      throw new DomainError('INVALID_ARGUMENT', 'carId, brand, model, color, and carteGriseUrl are required');
    }

    if (!isValidRegistrationPath(carteGriseUrl, userId)) {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid registration document path');
    }

    return this.transactionRunner.run(async (tx) => {
      const user = await this.userRepository.getById(userId, tx);
      assertHasRole(user, 'owner', 'Only owners can retry car registration');

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }
      if (car.ownerId !== userId) {
        throw new DomainError('PERMISSION_DENIED', 'You can only modify your own cars');
      }
      if (car.status !== 'rejected') {
        throw new DomainError('FAILED_PRECONDITION', 'You can only retry rejected cars');
      }

      if (plateNumber !== undefined && normalizePlate(plateNumber) !== car.plateNumberNormalized) {
        throw new DomainError('INVALID_ARGUMENT', 'Plate number cannot be modified on retry');
      }

      await this.carRepository.update(
        carId,
        {
          brand: brand.trim(),
          model: model.trim(),
          color: color.trim(),
          carteGriseUrl: carteGriseUrl.trim(),
          status: 'activation_pending',
          rejectionReason: null,
        },
        tx
      );

      await this.carRepository.addAuditLog(
        {
          carId,
          actorId: userId,
          action: 'RETRY_ACTIVATION',
          timestamp: new Date(),
        },
        tx
      );

      return { ok: true };
    });
  }
}
