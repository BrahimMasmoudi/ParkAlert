import { CarRepository } from '../../../domain/repositories/car.repository';
import { DocumentStoragePort } from '../../../domain/repositories/storage.port';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { DomainError } from '../../../domain/errors/domain.error';

export type DocumentKind = 'active' | 'pendingTransfer';

export interface GetDocumentUrlRequest {
  carId: string;
  documentKind: DocumentKind;
  callerId: string;
}

/**
 * Issues a short-lived signed URL for a vehicle's registration or pending transfer document
 * only after verifying live role and current ownership authorization.
 */
export class GetDocumentUrlUseCase {
  constructor(
    private readonly carRepository: CarRepository,
    private readonly userRepository: UserRepository,
    private readonly storagePort: DocumentStoragePort
  ) {}

  async execute(request: GetDocumentUrlRequest): Promise<{ url: string; expiresAt: number }> {
    const { carId, documentKind, callerId } = request;
    if (!carId || !callerId || (documentKind !== 'active' && documentKind !== 'pendingTransfer')) {
      throw new DomainError('INVALID_ARGUMENT', 'Valid carId, documentKind, and callerId are required');
    }

    const caller = await this.userRepository.getById(callerId);
    if (!caller) {
      throw new DomainError('PERMISSION_DENIED', 'Caller profile not found');
    }

    const car = await this.carRepository.getById(carId);
    if (!car) {
      throw new DomainError('NOT_FOUND', 'Car not found');
    }

    const roles = Array.isArray(caller.roles) ? caller.roles : [];
    const isPolice = roles.includes('police');
    const isOwner = roles.includes('owner');
    if (documentKind === 'active') {
      const isCurrentOwner = isOwner && car.ownerId === callerId;
      if (!isPolice && !isCurrentOwner) {
        throw new DomainError('PERMISSION_DENIED', 'Not authorized to access this vehicle document');
      }
    } else {
      const isTransferPending =
        car.status === 'transfer_pending_owner' || car.status === 'transfer_pending_police';
      const isAuthorizedOwner =
        isOwner &&
        isTransferPending &&
        (car.ownerId === callerId || car.transferToOwnerId === callerId);
      if (!isPolice && !isAuthorizedOwner) {
        throw new DomainError('PERMISSION_DENIED', 'Not authorized to access this transfer document');
      }
    }

    const targetPath =
      documentKind === 'active' ? car.carteGriseUrl : car.transferCarteGriseUrl;
    if (!targetPath) {
      throw new DomainError('NOT_FOUND', 'Document path not available');
    }

    if (targetPath.startsWith('https://') || targetPath.startsWith('http://')) {
      return { url: targetPath, expiresAt: Date.now() + 300_000 };
    }

    return this.storagePort.getSignedReadUrl(targetPath, 300);
  }
}
