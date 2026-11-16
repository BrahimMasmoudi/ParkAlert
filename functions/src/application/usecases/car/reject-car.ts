import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { validateRejectionReason } from '../../../domain/value-objects/plate';

export class RejectCarUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: { carId: string; reason: string; actorId: string }) {
    const { carId, reason, actorId } = request;
    if (!carId || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'carId and actorId are required');
    }

    const trimmedReason = validateRejectionReason(reason);

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      if (!actor || actor.role !== 'police') {
        throw new DomainError('PERMISSION_DENIED', 'Only police can reject cars');
      }

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }
      if (car.status !== 'activation_pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Car is not pending approval');
      }

      await this.carRepository.update(
        carId,
        {
          status: 'rejected',
          rejectionReason: trimmedReason,
        },
        tx
      );
      await this.carRepository.addAuditLog(
        {
          carId,
          actorId,
          action: 'REJECTED',
          reason: trimmedReason,
          timestamp: new Date(),
        },
        tx
      );
      return { ok: true };
    });
  }
}
