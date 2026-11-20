import { UserRepository } from '../../../domain/repositories/user.repository';
import { User } from '../../../domain/entities/user.entity';
import { DomainError } from '../../../domain/errors/domain.error';

const ALLOWED_PROFILE_FIELDS = new Set(['uid', 'fullName', 'identityNumber', 'birthDate', 'phone']);

export interface UpdateUserProfileRequest {
  uid: string;
  fullName?: string;
  identityNumber?: string;
  birthDate?: string;
  phone?: string;
}

export class UpdateUserProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(request: UpdateUserProfileRequest) {
    if (!request || typeof request !== 'object') {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid profile update payload');
    }

    const { uid } = request;
    if (!uid || typeof uid !== 'string') {
      throw new DomainError('INVALID_ARGUMENT', 'uid is required');
    }

    const updates: Partial<User> = {};
    for (const [key, value] of Object.entries(request)) {
      if (!ALLOWED_PROFILE_FIELDS.has(key)) {
        throw new DomainError('INVALID_ARGUMENT', 'Disallowed profile fields');
      }
      if (key === 'uid' || value === undefined) {
        continue;
      }
      if (typeof value !== 'string') {
        throw new DomainError('INVALID_ARGUMENT', `Invalid profile field type: ${key}`);
      }
      updates[key as keyof Pick<UpdateUserProfileRequest, 'fullName' | 'identityNumber' | 'birthDate' | 'phone'>] = value;
    }

    await this.userRepository.update(uid, updates);
    return { ok: true };
  }
}
