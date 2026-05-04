import { CarRepository } from '../../../domain/repositories/car.repository';

export class ApproveCarUseCase {
  constructor(private readonly carRepository: CarRepository) {}

  async execute(request: { carId: string; actorId: string }) {
    const { carId, actorId } = request;
    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.status !== 'activation_pending') throw new Error('Car is not pending approval');

    await this.carRepository.update(carId, { status: 'active' });
    await this.carRepository.addAuditLog({
      carId,
      actorId,
      action: 'APPROVED',
      timestamp: new Date(),
    });
    return { ok: true };
  }
}
