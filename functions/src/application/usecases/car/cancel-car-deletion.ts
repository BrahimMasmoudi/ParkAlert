import { CarRepository } from '../../../domain/repositories/car.repository';

export class CancelCarDeletionUseCase {
  constructor(private readonly carRepository: CarRepository) {}

  async execute(request: { carId: string; userId: string }) {
    const { carId, userId } = request;
    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.ownerId !== userId) throw new Error('Not your car');
    if (car.status !== 'deletion_requested') throw new Error('Not pending deletion');

    await this.carRepository.update(carId, {
      status: 'activation_pending',
      deletionRequestedAt: null, // Should be handled by adapter or FieldValue.delete()
    });

    await this.carRepository.addAuditLog({
      carId,
      actorId: userId,
      action: 'DELETION_CANCELLED',
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
