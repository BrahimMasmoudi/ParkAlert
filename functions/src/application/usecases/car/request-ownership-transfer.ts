import { CarRepository } from '../../../domain/repositories/car.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { isValidTransferPath, normalizePlate } from '../../../domain/value-objects/plate';
import { assertHasRole } from '../shared/user-authorization';

export class RequestOwnershipTransferUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly fineRepository: FineRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: { plateNumber: string; receiverId: string; carteGriseUrl: string }) {
    const { plateNumber, receiverId, carteGriseUrl } = request;
    if (!plateNumber || !receiverId || !carteGriseUrl) {
      throw new DomainError('INVALID_ARGUMENT', 'Missing required fields');
    }

    if (!isValidTransferPath(carteGriseUrl, receiverId)) {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid transfer document path');
    }

    return this.transactionRunner.run(async (tx) => {
      const receiver = await this.userRepository.getById(receiverId, tx);
      assertHasRole(receiver, 'owner', 'Only owners can request vehicle transfers');

      const car = await this.carRepository.getByPlateNumber(plateNumber, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }

      if (car.ownerId === receiverId) {
        throw new DomainError('FAILED_PRECONDITION', 'You already own this car');
      }

      if (car.status !== 'active') {
        throw new DomainError('FAILED_PRECONDITION', 'Vehicle must be active to initiate an ownership transfer');
      }

      const normalizedPlate = car.plateNumberNormalized || normalizePlate(car.plateNumber);
      const hasUnpaid = await this.fineRepository.hasUnpaidFines(car.ownerId, normalizedPlate, tx);
      if (hasUnpaid) {
        throw new DomainError('FAILED_PRECONDITION', 'UNPAID_FINES_EXIST');
      }

      const carId = car.id;
      await this.carRepository.update(
        carId,
        {
          status: 'transfer_pending_owner',
          transferToOwnerId: receiverId,
          transferCarteGriseUrl: carteGriseUrl.trim(),
          transferRequestedAt: new Date(),
          transferRejectionReason: null,
        },
        tx
      );

      await this.carRepository.addAuditLog(
        {
          carId,
          actorId: receiverId,
          action: 'TRANSFER_INITIATED_BY_RECEIVER',
          details: `Transfer requested by user ${receiverId}`,
          timestamp: new Date(),
        },
        tx
      );

      return { ok: true };
    });
  }
}
