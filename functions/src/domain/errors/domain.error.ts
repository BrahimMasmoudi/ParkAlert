export type DomainErrorCode =
  | 'PERMISSION_DENIED'
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'FAILED_PRECONDITION'
  | 'ALREADY_EXISTS';

/**
 * Pure domain error decoupled from transport/framework error types.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
