import { CarRepository } from '../../../domain/repositories/car.repository';
import { PoliceAuditPort } from '../../../domain/repositories/police-audit.port';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { normalizePlate, validateRejectionReason } from '../../../domain/value-objects/plate';
import { assertHasRole, assertNotSelfEnforcement } from '../shared/user-authorization';

export class RejectTransferUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly policeAuditPort: PoliceAuditPort
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

      const isPoliceStage = car.status === 'transfer_pending_police';
      if (car.status === 'transfer_pending_owner') {
        assertHasRole(actor, 'owner', 'Only the current vehicle owner can reject at this stage');
        if (car.ownerId !== actorId) {
          throw new DomainError('PERMISSION_DENIED', 'Only the current vehicle owner can reject at this stage');
        }
      } else if (isPoliceStage) {
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

      if (isPoliceStage) {
        await this.policeAuditPort.addLog(
          {
            targetType: 'car',
            targetId: carId,
            actorId,
            ownerId: car.ownerId,
            plateNumber: car.plateNumber,
            plateNumberNormalized: car.plateNumberNormalized || normalizePlate(car.plateNumber),
            action: 'TRANSFER_REJECTED',
            reason: trimmedReason || null,
          },
          tx
        );
      }

      return { ok: true };
    });
  }
}
