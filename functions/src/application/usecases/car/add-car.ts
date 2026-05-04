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

    const carId = this.carRepository.generateId();
    const car: Car = {
      id: carId,
      ownerId: request.userId,
      plateNumber: String(plateNumber).toUpperCase(),
      brand,
      model,
      color,
      carteGriseUrl,
      status: 'activation_pending',
      createdAt: new Date(),
    };

    await this.carRepository.create(car);
    return { ok: true, carId };
  }
}
