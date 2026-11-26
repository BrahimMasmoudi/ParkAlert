import { CarRepository } from '../../../domain/repositories/car.repository';
import { PoliceAuditPort } from '../../../domain/repositories/police-audit.port';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { normalizePlate } from '../../../domain/value-objects/plate';
import { assertHasRole, assertNotSelfEnforcement } from '../shared/user-authorization';

export class ApproveCarUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly policeAuditPort: PoliceAuditPort
  ) {}

  async execute(request: { carId: string; actorId: string }) {
    const { carId, actorId } = request;
    if (!carId || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'carId and actorId are required');
    }

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      assertHasRole(actor, 'police', 'Only police can approve cars');

      const car = await this.carRepository.getById(carId, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Car not found');
      }
      assertNotSelfEnforcement(actorId, [car.ownerId], { targetType: 'car', targetId: carId });
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
      await this.policeAuditPort.addLog(
        {
          targetType: 'car',
          targetId: carId,
          actorId,
          ownerId: car.ownerId,
          plateNumber: car.plateNumber,
          plateNumberNormalized: car.plateNumberNormalized || normalizePlate(car.plateNumber),
          action: 'CAR_APPROVED',
          reason: null,
        },
        tx
      );
      return { ok: true };
    });
  }
}
