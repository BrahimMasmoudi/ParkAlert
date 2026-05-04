import { CarRepository } from '../../../domain/repositories/car.repository';

export class RequestCarDeletionUseCase {
  constructor(private readonly carRepository: CarRepository) {}

  async execute(request: { carId: string; userId: string }) {
    const { carId, userId } = request;
    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.ownerId !== userId) throw new Error('You can only delete your own cars');

    await this.carRepository.update(carId, {
      status: 'deletion_requested',
      deletionRequestedAt: new Date(),
    });

    await this.carRepository.addAuditLog({
      carId,
      actorId: userId,
      action: 'DELETION_REQUESTED',
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
