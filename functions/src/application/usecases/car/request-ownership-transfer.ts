import { CarRepository } from '../../../domain/repositories/car.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';

export class RequestOwnershipTransferUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly fineRepository: FineRepository
  ) {}

  async execute(request: { plateNumber: string; receiverId: string; carteGriseUrl: string }) {
    const { plateNumber, receiverId, carteGriseUrl } = request;
    if (!plateNumber || !receiverId || !carteGriseUrl) throw new Error('Missing required fields');

    const car = await this.carRepository.getByPlateNumber(plateNumber);
    
    if (!car) throw new Error('Car not found');
    const carId = car.id; // Use the actual document ID from the found car
    
    if (car.ownerId === receiverId) throw new Error('You already own this car');
    
    if (['transfer_pending_owner', 'transfer_pending_police'].includes(car.status)) {
      throw new Error('A transfer is already in progress for this vehicle');
    }

    const normalizedPlate = car.plateNumberNormalized;
    // Block if current owner has unpaid fines for this vehicle
    const hasUnpaid = await this.fineRepository.hasUnpaidFines(car.ownerId, normalizedPlate);
    if (hasUnpaid) {
      throw new Error('UNPAID_FINES_EXIST');
    }

    await this.carRepository.update(carId, {
      status: 'transfer_pending_owner',
      transferToOwnerId: receiverId,
      transferCarteGriseUrl: carteGriseUrl,
      transferRequestedAt: new Date(),
      transferRejectionReason: null,
    });

    await this.carRepository.addAuditLog({
      carId,
      actorId: receiverId,
      action: 'TRANSFER_INITIATED_BY_RECEIVER',
      details: `Transfer requested by user ${receiverId}`,
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
