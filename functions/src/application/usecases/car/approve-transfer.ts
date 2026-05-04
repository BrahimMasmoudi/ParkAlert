import { CarRepository } from '../../../domain/repositories/car.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';

export interface ApproveTransferRequest {
  carId: string;
  actorId: string;
}

export class ApproveTransferUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly fineRepository: FineRepository
  ) {}

  async execute(request: ApproveTransferRequest) {
    const { carId, actorId } = request;
    if (!carId) throw new Error('carId is required');

    const car = await this.carRepository.getById(carId);
    if (!car) throw new Error('Car not found');

    if (car.status !== 'transfer_requested') {
      throw new Error('Car is not pending transfer');
    }

    if (car.ownerId) {
      const hasUnpaid = await this.fineRepository.hasUnpaidFines(car.ownerId, car.plateNumber);
      if (hasUnpaid) {
        throw new Error('Cannot approve transfer: unpaid fines exist for this vehicle.');
      }
    }

    const updates: any = {
      status: 'active',
    };

    if (car.transferToOwnerId) {
      updates.ownerId = car.transferToOwnerId;
      updates.ownershipHistory = [...(car.ownershipHistory || []), car.ownerId];
      updates.transferToOwnerId = null; // Use null to be handled by adapter or FieldValue.delete()
      
      if (car.transferCarteGriseUrl) {
        updates.carteGriseUrl = car.transferCarteGriseUrl;
        updates.transferCarteGriseUrl = null;
      }
    }

    await this.carRepository.update(carId, updates);
    await this.carRepository.addAuditLog({
      carId,
      actorId,
      action: 'TRANSFER_APPROVED',
      timestamp: new Date(),
    });

    return { ok: true };
  }
}
