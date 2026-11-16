import { CarRepository } from '../../../domain/repositories/car.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { normalizePlate } from '../../../domain/value-objects/plate';

export interface ApproveTransferRequest {
  carId: string;
  actorId: string;
}

export class ApproveTransferUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly fineRepository: FineRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: ApproveTransferRequest) {
    const { carId, actorId } = request;
    if (!carId || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'carId and actorId are required');
    }

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      if (!actor || actor.role !== 'police') {
        throw new DomainError('PERMISSION_DENIED', 'Only police can approve ownership transfers');
      }

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }

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
      await this.carRepository.update(
        carId,
        {
          status: 'active',
          ownerId: car.transferToOwnerId,
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
          details: `Transferred from ${previousOwnerId} to ${car.transferToOwnerId}`,
          timestamp: new Date(),
        },
        tx
      );

      return { ok: true };
    });
  }
}
