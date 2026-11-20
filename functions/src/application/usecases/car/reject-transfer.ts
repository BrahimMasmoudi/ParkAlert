import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { validateRejectionReason } from '../../../domain/value-objects/plate';
import { assertHasRole, assertNotSelfEnforcement } from '../shared/user-authorization';

export class RejectTransferUseCase {
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
      if (!actor) {
        throw new DomainError('PERMISSION_DENIED', 'Unauthorized user');
      }

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }

      if (car.status === 'transfer_pending_owner') {
        assertHasRole(actor, 'owner', 'Only the current vehicle owner can reject at this stage');
        if (car.ownerId !== actorId) {
          throw new DomainError('PERMISSION_DENIED', 'Only the current vehicle owner can reject at this stage');
        }
      } else if (car.status === 'transfer_pending_police') {
        assertHasRole(actor, 'police', 'Only police can reject a transfer awaiting police approval');
        assertNotSelfEnforcement(actorId, [car.ownerId, car.transferToOwnerId], {
          targetType: 'car_transfer',
          targetId: carId,
        });
      } else {
        throw new DomainError('FAILED_PRECONDITION', 'Car is not pending transfer');
      }

      await this.carRepository.update(
        carId,
        {
          status: 'active',
          transferRejectionReason: trimmedReason,
          transferToOwnerId: null,
          transferCarteGriseUrl: null,
          transferRequestedAt: null,
        },
        tx
      );

      await this.carRepository.addAuditLog(
        {
          carId,
          actorId,
          action: 'TRANSFER_REJECTED',
          details: trimmedReason,
          reason: trimmedReason,
          timestamp: new Date(),
        },
        tx
      );

      return { ok: true };
    });
  }
}
