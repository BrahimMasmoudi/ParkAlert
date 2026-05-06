import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { Car } from '../../../domain/entities/car.entity';

export interface AddCarRequest {
  userId: string;
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  carteGriseUrl: string;
}

export class AddCarUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository
  ) {}

  async execute(request: AddCarRequest) {
    const user = await this.userRepository.getById(request.userId);
    if (!user || user.role !== 'owner') {
      throw new Error('Only owners can add cars');
    }

    const { plateNumber, brand, model, color, carteGriseUrl } = request;
    if (!plateNumber || !brand || !model || !color || !carteGriseUrl) {
      throw new Error('plateNumber, brand, model, color, and carteGriseUrl are required');
    }

    const formattedPlate = String(plateNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const existingCar = await this.carRepository.getById(formattedPlate);
    
    if (existingCar) {
      if (existingCar.ownerId === request.userId) {
        throw new Error('You have already registered this vehicle');
      }
      throw new Error('VEHICLE_ALREADY_REGISTERED');
    }

    const car: Car = {
      id: formattedPlate,
      ownerId: request.userId,
      plateNumber: plateNumber.toUpperCase(), // Keep dashes if they were there
      plateNumberNormalized: formattedPlate,
      brand,
      model,
      color,
      carteGriseUrl,
      status: 'activation_pending',
      createdAt: new Date(),
    };

    await this.carRepository.create(car);
    return { ok: true, carId: formattedPlate };
  }
}
