import { CarRepository } from '../../../domain/repositories/car.repository';

export class RetryCarUseCase {
  constructor(private readonly carRepository: CarRepository) {}

  async execute(request: { carId: string; userId: string; plateNumber: string; brand: string; model: string; color: string; carteGriseUrl: string }) {
    const { carId, userId, ...updates } = request;
    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.ownerId !== userId) throw new Error('You can only modify your own cars');
    if (car.status !== 'rejected') throw new Error('You can only retry rejected cars');

    await this.carRepository.update(carId, {
      ...updates,
      plateNumber: updates.plateNumber.toUpperCase(),
      status: 'activation_pending',
      rejectionReason: null, // Should be delete in adapter
    });

    await this.carRepository.addAuditLog({
      carId,
      actorId: userId,
      action: 'RETRY_ACTIVATION',
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
