import { CarRepository } from '../../../domain/repositories/car.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { PoliceAuditPort } from '../../../domain/repositories/police-audit.port';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { normalizePlate } from '../../../domain/value-objects/plate';
import { assertHasRole, assertNotSelfEnforcement } from '../shared/user-authorization';

export interface ApproveTransferRequest {
  carId: string;
  actorId: string;
}

export class ApproveTransferUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly fineRepository: FineRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly policeAuditPort: PoliceAuditPort
  ) {}

  async execute(request: ApproveTransferRequest) {
    const { carId, actorId } = request;
    if (!carId || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'carId and actorId are required');
    }

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      assertHasRole(actor, 'police', 'Only police can approve ownership transfers');

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }
      assertNotSelfEnforcement(actorId, [car.ownerId, car.transferToOwnerId], {
        targetType: 'car_transfer',
        targetId: carId,
      });

      if (car.status !== 'transfer_pending_police') {
        throw new DomainError('FAILED_PRECONDITION', 'Car is not pending police approval for transfer');
      }

      if (!car.transferToOwnerId || car.transferToOwnerId === car.ownerId || !car.transferCarteGriseUrl) {
        throw new DomainError('FAILED_PRECONDITION', 'Incomplete transfer recipient or document');
      }

      const normalizedPlate = car.plateNumberNormalized || normalizePlate(car.plateNumber);
      const hasUnpaid = await this.fineRepository.hasUnpaidFines(car.ownerId, normalizedPlate, tx);
      if (hasUnpaid) {
        throw new DomainError('FAILED_PRECONDITION', 'Cannot approve transfer: unpaid fines exist for this vehicle.');
      }

      const previousOwnerId = car.ownerId;
      const nextOwnerId = car.transferToOwnerId;
      await this.carRepository.update(
        carId,
        {
          status: 'active',
          ownerId: nextOwnerId,
          carteGriseUrl: car.transferCarteGriseUrl,
          ownershipHistory: [...(car.ownershipHistory || []), previousOwnerId],
          transferToOwnerId: null,
          transferCarteGriseUrl: null,
          transferRequestedAt: null,
          transferRejectionReason: null,
        },
        tx
      );

      await this.carRepository.addAuditLog(
        {
          carId,
          actorId,
          action: 'TRANSFER_APPROVED',
          details: `Transferred from ${previousOwnerId} to ${nextOwnerId}`,
          timestamp: new Date(),
        },
        tx
      );

      await this.policeAuditPort.addLog(
        {
          targetType: 'car',
          targetId: carId,
          actorId,
          ownerId: nextOwnerId,
          plateNumber: car.plateNumber,
          plateNumberNormalized: normalizedPlate,
          action: 'TRANSFER_APPROVED',
          reason: null,
        },
        tx
      );

      return { ok: true };
    });
  }
}
