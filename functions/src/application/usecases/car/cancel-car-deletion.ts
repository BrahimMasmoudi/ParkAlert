import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { assertHasRole } from '../shared/user-authorization';

export class CancelCarDeletionUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: { carId: string; userId: string }) {
    const { carId, userId } = request;
    if (!carId || !userId) {
      throw new DomainError('INVALID_ARGUMENT', 'carId and userId are required');
    }

    return this.transactionRunner.run(async (tx) => {
      const user = await this.userRepository.getById(userId, tx);
      assertHasRole(user, 'owner', 'Only owners can cancel car deletion');

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }
      if (car.ownerId !== userId) {
        throw new DomainError('PERMISSION_DENIED', 'Not your car');
      }
      if (car.status !== 'deletion_requested') {
        throw new DomainError('FAILED_PRECONDITION', 'Not pending deletion');
      }

      const restoredStatus = car.preDeletionStatus ?? 'active';

      await this.carRepository.update(
        carId,
        {
          status: restoredStatus,
          preDeletionStatus: null,
          deletionRequestedAt: null,
        },
        tx
      );

      await this.carRepository.addAuditLog(
        {
          carId,
          actorId: userId,
          action: 'DELETION_CANCELLED',
          timestamp: new Date(),
        },
        tx
      );

      return { ok: true };
    });
  }
}
