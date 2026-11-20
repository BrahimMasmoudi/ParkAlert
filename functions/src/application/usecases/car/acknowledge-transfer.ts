import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { assertHasRole } from '../shared/user-authorization';

export class AcknowledgeTransferUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: { carId: string; ownerId: string }) {
    const { carId, ownerId } = request;
    if (!carId || !ownerId) {
      throw new DomainError('INVALID_ARGUMENT', 'carId and ownerId are required');
    }

    return this.transactionRunner.run(async (tx) => {
      const user = await this.userRepository.getById(ownerId, tx);
      assertHasRole(user, 'owner', 'Only owners can acknowledge a transfer');

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }
      if (car.ownerId !== ownerId) {
        throw new DomainError('PERMISSION_DENIED', 'Only the current owner can acknowledge the transfer');
      }
      if (car.status !== 'transfer_pending_owner') {
        throw new DomainError('FAILED_PRECONDITION', 'No pending transfer acknowledgment for this vehicle');
      }

      await this.carRepository.update(
        carId,
        {
          status: 'transfer_pending_police',
        },
        tx
      );

      await this.carRepository.addAuditLog(
        {
          carId,
          actorId: ownerId,
          action: 'TRANSFER_ACKNOWLEDGED_BY_OWNER',
          timestamp: new Date(),
        },
        tx
      );

      return { ok: true };
    });
  }
}
