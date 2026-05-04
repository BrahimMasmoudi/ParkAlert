import { UserRepository } from '../../../domain/repositories/user.repository';
import { UserRole } from '../../../domain/entities/user.entity';

export interface SetUserRoleRequest {
  uid: string;
  role: string;
  name?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
}

export class SetUserRoleUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(request: SetUserRoleRequest) {
    const { uid, role, name, email, phone, photoURL } = request;

    if (!['agent', 'police', 'owner'].includes(role)) {
      throw new Error('Invalid role');
    }

    await this.userRepository.save({
      uid,
      email: email ?? '',
      name: name ?? '',
      phone: phone ?? '',
      photoURL: photoURL ?? '',
      role: role as UserRole,
    });

    return { ok: true };
  }
}
