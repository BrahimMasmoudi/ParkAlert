import { CarRepository } from '../../../domain/repositories/car.repository';

export class RejectTransferUseCase {
  constructor(private readonly carRepository: CarRepository) {}

  async execute(request: { carId: string; reason: string; actorId: string }) {
    const { carId, reason, actorId } = request;
    if (!carId) throw new Error('carId is required');
    if (!reason || reason.trim() === '') throw new Error('reason is required');

    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.status !== 'transfer_requested') throw new Error('Car is not pending transfer');

    await this.carRepository.update(carId, {
      status: 'active',
      transferRejectionReason: reason,
      transferToOwnerId: null,
      transferCarteGriseUrl: null,
    });

    await this.carRepository.addAuditLog({
      carId,
      actorId,
      action: 'TRANSFER_REJECTED',
      details: reason,
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
