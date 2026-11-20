import * as logger from 'firebase-functions/logger';
import { User, UserRole } from '../../../domain/entities/user.entity';
import { CarRepository } from '../../../domain/repositories/car.repository';
import { TransactionContext } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { normalizePlate } from '../../../domain/value-objects/plate';

/**
 * Verifies that the loaded user exists and holds the required capability role.
 */
export function assertHasRole(
  user: User | null | undefined,
  requiredRole: UserRole,
  message: string
): asserts user is User {
  if (!user || !Array.isArray(user.roles) || !user.roles.includes(requiredRole)) {
    throw new DomainError('PERMISSION_DENIED', message);
  }
}

/**
 * Blocks police officers from acting on vehicles, transfers, fines, disputes, or reports
 * associated with their own user ID.
 */
export function assertNotSelfEnforcement(
  actorId: string,
  ownerIds: Array<string | null | undefined>,
  context: { targetType: string; targetId: string }
): void {
  const isSelfOwned = ownerIds.some((id) => typeof id === 'string' && id.length > 0 && id === actorId);
  if (!isSelfOwned) {
    return;
  }

  logger.warn('SELF_ENFORCEMENT_BLOCKED', {
    actorId,
    targetType: context.targetType,
    targetId: context.targetId,
  });
  throw new DomainError(
    'PERMISSION_DENIED',
    'Police officers cannot take enforcement actions on their own vehicles or fines'
  );
}

/**
 * Resolves all owner and incoming-buyer IDs across matching active, rejected, and archived
 * vehicles for every distinct non-empty license plate provided.
 */
export async function collectPlateOwnerIds(
  carRepository: CarRepository,
  plates: Array<string | null | undefined>,
  tx?: TransactionContext
): Promise<string[]> {
  const seenNormalized = new Set<string>();
  const distinctPlates: string[] = [];

  for (const plate of plates) {
    if (!plate) continue;
    const normalized = normalizePlate(plate);
    if (!normalized || seenNormalized.has(normalized)) continue;
    seenNormalized.add(normalized);
    distinctPlates.push(plate);
  }

  const carLists = await Promise.all(
    distinctPlates.map((plate) =>
      carRepository.getAllByPlateNumber(plate, tx, {
        includeRejected: true,
        includeArchived: true,
      })
    )
  );

  const ownerIds: string[] = [];
  for (const cars of carLists) {
    for (const car of cars) {
      if (car.ownerId) ownerIds.push(car.ownerId);
      if (car.transferToOwnerId) ownerIds.push(car.transferToOwnerId);
    }
  }
  return ownerIds;
}
