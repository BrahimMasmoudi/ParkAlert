import { ReportRepository } from '../../../domain/repositories/report.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { DocumentStoragePort } from '../../../domain/repositories/storage.port';
import { ReportPhoto, ReportPhotoSlot } from '../../../domain/entities/report.entity';
import { DomainError } from '../../../domain/errors/domain.error';

export type EvidenceTargetType = 'report' | 'fine';

export interface GetEvidenceUrlsRequest {
  targetType: EvidenceTargetType;
  targetId: string;
  callerId: string;
}

export interface EvidenceUrlItem {
  slot: ReportPhotoSlot;
  url: string | null;
  expiresAt: number | null;
  error?: 'not_found';
}

/**
 * Resolves short-lived signed URLs for report or fine evidence photos after verifying
 * live caller role, ownership, and fine cancellation status.
 */
export class GetEvidenceUrlsUseCase {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly fineRepository: FineRepository,
    private readonly userRepository: UserRepository,
    private readonly storagePort: DocumentStoragePort
  ) {}

  async execute(request: GetEvidenceUrlsRequest): Promise<{ ok: true; items: EvidenceUrlItem[] }> {
    const { targetType, targetId, callerId } = request;
    if (!targetId || !callerId || (targetType !== 'report' && targetType !== 'fine')) {
      throw new DomainError('INVALID_ARGUMENT', 'Valid targetType, targetId, and callerId are required');
    }

    const caller = await this.userRepository.getById(callerId);
    if (!caller) {
      throw new DomainError('PERMISSION_DENIED', 'Caller profile not found');
    }

    let photos: ReportPhoto[] = [];

    const callerRoles = Array.isArray(caller.roles) ? caller.roles : [];

    if (targetType === 'report') {
      const report = await this.reportRepository.getById(targetId);
      if (!report) {
        throw new DomainError('NOT_FOUND', 'Report not found');
      }

      const isAuthorized =
        callerRoles.includes('police') ||
        (callerRoles.includes('agent') && report.agentId === callerId);
      if (!isAuthorized) {
        throw new DomainError('PERMISSION_DENIED', 'Not authorized to access report evidence');
      }

      if (report.photos && report.photos.length > 0) {
        photos = report.photos;
      } else if (report.photoUrl && report.photoUrl.trim().length > 0) {
        photos = [{ path: report.photoUrl.trim(), slot: 'context' }];
      }
    } else {
      const fine = await this.fineRepository.getById(targetId);
      if (!fine) {
        throw new DomainError('NOT_FOUND', 'Fine not found');
      }

      const isPolice = callerRoles.includes('police');
      const isAuthorizedOwner =
        callerRoles.includes('owner') && fine.ownerId === callerId && fine.status !== 'cancelled';

      if (!isPolice && !isAuthorizedOwner) {
        throw new DomainError('PERMISSION_DENIED', 'Not authorized to access fine evidence');
      }

      photos = fine.evidencePhotos ?? [];
    }

    if (photos.length === 0) {
      return { ok: true, items: [] };
    }

    const settled = await Promise.allSettled(
      photos.map(async (photo): Promise<EvidenceUrlItem> => {
        if (photo.path.startsWith('https://') || photo.path.startsWith('http://')) {
          return { slot: photo.slot, url: photo.path, expiresAt: null };
        }
        const signed = await this.storagePort.getSignedReadUrl(photo.path, 300);
        return { slot: photo.slot, url: signed.url, expiresAt: signed.expiresAt };
      })
    );

    const items: EvidenceUrlItem[] = settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        slot: photos[index].slot,
        url: null,
        expiresAt: null,
        error: 'not_found',
      };
    });

    return { ok: true, items };
  }
}
