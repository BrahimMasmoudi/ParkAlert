import { DomainError } from '../errors/domain.error';

/**
 * Normalizes a license plate into an uppercase alphanumeric identifier.
 */
export function normalizePlate(plateNumber: string): string {
  return String(plateNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Validates that a Storage path belongs cleanly to the caller's authorized upload prefix.
 */
function isValidScopedStoragePath(
  path: unknown,
  prefix: 'carteGrise' | 'transfers',
  callerUid: string
): path is string {
  if (typeof path !== 'string' || path.trim() === '' || !callerUid) {
    return false;
  }
  const trimmed = path.trim();
  if (
    trimmed.includes('..') ||
    trimmed.includes('\\') ||
    trimmed.includes('://') ||
    trimmed.startsWith('/')
  ) {
    return false;
  }
  const expectedPrefix = `${prefix}/${callerUid}/`;
  if (!trimmed.startsWith(expectedPrefix)) {
    return false;
  }
  const remainder = trimmed.slice(expectedPrefix.length);
  return remainder.length > 0 && !remainder.includes('/');
}

/**
 * Validates that a vehicle registration document path belongs to `carteGrise/<callerUid>/<file>`.
 */
export function isValidRegistrationPath(path: unknown, callerUid: string): path is string {
  return isValidScopedStoragePath(path, 'carteGrise', callerUid);
}

/**
 * Validates that a transfer document path belongs to `transfers/<callerUid>/<file>`.
 */
export function isValidTransferPath(path: unknown, callerUid: string): path is string {
  return isValidScopedStoragePath(path, 'transfers', callerUid);
}

/**
 * Validates a trimmed rejection reason falls within the allowed 3..500 character range.
 */
export function validateRejectionReason(reason: unknown): string {
  if (typeof reason !== 'string') {
    throw new DomainError('INVALID_ARGUMENT', 'reason is required');
  }
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    throw new DomainError('INVALID_ARGUMENT', 'Rejection reason must be between 3 and 500 characters');
  }
  return trimmed;
}
