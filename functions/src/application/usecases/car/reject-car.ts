import { CarRepository } from '../../../domain/repositories/car.repository';

export class RejectCarUseCase {
  constructor(private readonly carRepository: CarRepository) {}

  async execute(request: { carId: string; reason: string; actorId: string }) {
    const { carId, reason, actorId } = request;
    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.status !== 'activation_pending') throw new Error('Car is not pending approval');

    await this.carRepository.update(carId, { 
      status: 'rejected',
      rejectionReason: reason.trim()
    });
    await this.carRepository.addAuditLog({
      carId,
      actorId,
      action: 'REJECTED',
      reason: reason.trim(),
      timestamp: new Date(),
    });
    return { ok: true };
  }
}
