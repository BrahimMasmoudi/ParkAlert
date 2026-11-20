import { CarRepository } from '../../../domain/repositories/car.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { assertHasRole } from '../shared/user-authorization';

export class RequestCarDeletionUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly fineRepository: FineRepository,
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
      assertHasRole(user, 'owner', 'Only owners can request car deletion');

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }
      if (car.ownerId !== userId) {
        throw new DomainError('PERMISSION_DENIED', 'You can only delete your own cars');
      }
      if (car.status !== 'active' && car.status !== 'rejected') {
        throw new DomainError('FAILED_PRECONDITION', 'Deletion is only allowed for active or rejected vehicles');
      }

      const hasUnpaidFines = await this.fineRepository.hasUnpaidFines(car.ownerId, car.plateNumber, tx);
      if (hasUnpaidFines) {
        throw new DomainError('FAILED_PRECONDITION', 'Cannot delete a vehicle with unpaid fines');
      }

      await this.carRepository.update(
        carId,
        {
          status: 'deletion_requested',
          preDeletionStatus: car.status,
          deletionRequestedAt: new Date(),
        },
        tx
      );

      await this.carRepository.addAuditLog(
        {
          carId,
          actorId: userId,
          action: 'DELETION_REQUESTED',
          timestamp: new Date(),
        },
        tx
      );

      return { ok: true };
    });
  }
}
