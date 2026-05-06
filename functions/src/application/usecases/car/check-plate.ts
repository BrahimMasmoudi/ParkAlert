import { CarRepository } from '../../../domain/repositories/car.repository';

export class CheckPlateAvailabilityUseCase {
  constructor(private readonly carRepository: CarRepository) {}

  async execute(plateNumber: string) {
    if (!plateNumber) throw new Error('plateNumber is required');
    const car = await this.carRepository.getByPlateNumber(plateNumber);

    if (!car) {
      return { available: true };
    }

    // Following user feedback: Only show "already registered", don't leak owner details.
    return { 
      available: false, 
      status: car.status,
      ownerIdMasked: car.ownerId.substring(0, 3) + '...' // Minimal info for internal tracking if needed
    };
  }
}
