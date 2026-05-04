import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';

export class ApproveCarDeletionUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository
  ) {}

  async execute(request: { carId: string; actorId: string }) {
    const { carId, actorId } = request;
    const actor = await this.userRepository.getById(actorId);
    if (!actor || actor.role !== 'police') throw new Error('Only police can approve deletions');

    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.status !== 'deletion_requested') throw new Error('Car not pending deletion');

    await this.carRepository.update(carId, {
      status: 'archived',
      archivedAt: new Date(),
      archivedBy: actorId,
    });

    await this.carRepository.addAuditLog({
      carId,
      actorId,
      action: 'DELETION_APPROVED',
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
