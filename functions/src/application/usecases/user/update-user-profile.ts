import { UserRepository } from '../../../domain/repositories/user.repository';

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
    const { uid, ...updates } = request;
    await this.userRepository.update(uid, updates);
    return { ok: true };
  }
}
