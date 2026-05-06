import { CarRepository } from '../../../domain/repositories/car.repository';

export class AcknowledgeTransferUseCase {
  constructor(private readonly carRepository: CarRepository) {}

  async execute(request: { carId: string; ownerId: string }) {
    const { carId, ownerId } = request;
    if (!carId || !ownerId) throw new Error('carId and ownerId are required');

    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.ownerId !== ownerId) throw new Error('Only the current owner can acknowledge the transfer');
    if (car.status !== 'transfer_pending_owner') throw new Error('No pending transfer acknowledgment for this vehicle');

    await this.carRepository.update(carId, {
      status: 'transfer_pending_police',
    });

    await this.carRepository.addAuditLog({
      carId,
      actorId: ownerId,
      action: 'TRANSFER_ACKNOWLEDGED_BY_OWNER',
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
