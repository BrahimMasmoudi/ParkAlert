import { HttpsError } from 'firebase-functions/v2/https';
import { DomainError, DomainErrorCode } from '../../../domain/errors/domain.error';

const DOMAIN_TO_HTTPS_CODE: Record<DomainErrorCode, HttpsError['code']> = {
  PERMISSION_DENIED: 'permission-denied',
  INVALID_ARGUMENT: 'invalid-argument',
  NOT_FOUND: 'not-found',
  FAILED_PRECONDITION: 'failed-precondition',
  ALREADY_EXISTS: 'already-exists',
};

/**
 * Maps pure domain errors to semantic Firebase Cloud Functions HttpsError instances.
 */
export function mapDomainErrorToHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) {
    return error;
  }
  if (error instanceof DomainError) {
    return new HttpsError(DOMAIN_TO_HTTPS_CODE[error.code], error.message);
  }
  const message = error instanceof Error ? error.message : 'Internal error';
  return new HttpsError('internal', message);
}
