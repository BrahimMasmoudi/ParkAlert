import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';

export class RequestOwnershipTransferUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository
  ) {}

  async execute(request: { carId: string; userId: string; newOwnerId: string; carteGriseUrl: string }) {
    const { carId, userId, newOwnerId, carteGriseUrl } = request;
    if (!carId || !newOwnerId || !carteGriseUrl) throw new Error('Missing required fields');

    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');
    if (car.ownerId !== userId) throw new Error('Not your car');

    const newOwner = await this.userRepository.getById(newOwnerId);
    if (!newOwner || newOwner.role !== 'owner') throw new Error('New owner not found');

    await this.carRepository.update(carId, {
      status: 'transfer_requested',
      transferToOwnerId: newOwnerId,
      transferCarteGriseUrl: carteGriseUrl,
      transferRequestedAt: new Date(),
      transferRejectionReason: null,
    });

    await this.carRepository.addAuditLog({
      carId,
      actorId: userId,
      action: 'TRANSFER_REQUESTED',
      details: `Transfer requested to ${newOwnerId}`,
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
