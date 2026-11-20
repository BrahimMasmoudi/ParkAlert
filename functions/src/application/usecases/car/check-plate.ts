import { CarRepository } from '../../../domain/repositories/car.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { DomainError } from '../../../domain/errors/domain.error';
import { assertHasRole } from '../shared/user-authorization';

export type PlateIneligibilityReason =
  | 'OWNED_BY_CALLER'
  | 'INELIGIBLE_STATUS'
  | 'TRANSFER_IN_PROGRESS';

export interface CheckPlateResponse {
  available: boolean;
  eligibleForTransfer: boolean;
  reason?: PlateIneligibilityReason;
}

export class CheckPlateAvailabilityUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository
  ) {}

  async execute(request: { plateNumber: string; callerId: string }): Promise<CheckPlateResponse> {
    const { plateNumber, callerId } = request;
    if (!plateNumber || !callerId) {
      throw new DomainError('INVALID_ARGUMENT', 'plateNumber and callerId are required');
    }

    const caller = await this.userRepository.getById(callerId);
    assertHasRole(caller, 'owner', 'Only owners can check plate availability');

    const car = await this.carRepository.getByPlateNumber(plateNumber);
    if (!car) {
      return { available: true, eligibleForTransfer: false };
    }

    if (car.ownerId === callerId) {
      return { available: false, eligibleForTransfer: false, reason: 'OWNED_BY_CALLER' };
    }

    if (car.status === 'transfer_pending_owner' || car.status === 'transfer_pending_police') {
      return { available: false, eligibleForTransfer: false, reason: 'TRANSFER_IN_PROGRESS' };
    }

    if (car.status !== 'active') {
      return { available: false, eligibleForTransfer: false, reason: 'INELIGIBLE_STATUS' };
    }

    return { available: false, eligibleForTransfer: true };
  }
}
