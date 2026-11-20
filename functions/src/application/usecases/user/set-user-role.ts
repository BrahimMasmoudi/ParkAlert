import * as logger from 'firebase-functions/logger';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { UserRole } from '../../../domain/entities/user.entity';
import { DomainError } from '../../../domain/errors/domain.error';

const ROLE_MAPPING: Record<UserRole, UserRole[]> = {
  owner: ['owner'],
  police: ['police', 'owner'],
  agent: ['agent', 'owner'],
};

export interface SetUserRoleRequest {
  uid: string;
  role: string;
  name?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
}

export class SetUserRoleUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: SetUserRoleRequest) {
    const { uid, role, name, email, phone, photoURL } = request;
    if (!uid) {
      throw new DomainError('INVALID_ARGUMENT', 'uid is required');
    }

    if (!role || !(role in ROLE_MAPPING)) {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid role');
    }

    const roles = ROLE_MAPPING[role as UserRole];

    return this.transactionRunner.run(async (tx) => {
      const existing = await this.userRepository.getById(uid, tx);
      if (existing?.roles?.length) {
        throw new DomainError('ALREADY_EXISTS', 'User role has already been assigned');
      }

      await this.userRepository.save(
        {
          uid,
          email: email ?? '',
          name: name ?? '',
          phone: phone ?? '',
          photoURL: photoURL ?? '',
          roles,
        },
        tx
      );

      logger.info('SET_USER_ROLE', { uid, roles });
      return { ok: true, roles };
    });
  }
}
