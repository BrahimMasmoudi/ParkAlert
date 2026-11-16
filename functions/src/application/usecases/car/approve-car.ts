import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';

export class ApproveCarUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: { carId: string; actorId: string }) {
    const { carId, actorId } = request;
    if (!carId || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'carId and actorId are required');
    }

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      if (!actor || actor.role !== 'police') {
        throw new DomainError('PERMISSION_DENIED', 'Only police can approve cars');
      }

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }
      if (car.status !== 'activation_pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Car is not pending approval');
      }

      await this.carRepository.update(carId, { status: 'active' }, tx);
      await this.carRepository.addAuditLog(
        {
          carId,
          actorId,
          action: 'APPROVED',
          timestamp: new Date(),
        },
        tx
      );
      return { ok: true };
    });
  }
}
