import * as logger from 'firebase-functions/logger';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { DocumentStoragePort } from '../../../domain/repositories/storage.port';
import { Report, ReportPhoto, ReportPhotoSlot } from '../../../domain/entities/report.entity';
import { DomainError } from '../../../domain/errors/domain.error';
import { isValidPlateFormat, isValidReportPath } from '../../../domain/value-objects/plate';
import { assertHasRole } from '../shared/user-authorization';

export interface CreateReportRequest {
  agentId: string;
  plateNumber: string;
  location?: { lat: number; lng: number } | null;
  photos: ReportPhoto[];
  address?: string;
}

const VALID_SLOTS = new Set<ReportPhotoSlot>(['context', 'plate', 'extra']);

export class CreateReportUseCase {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly userRepository: UserRepository,
    private readonly storagePort: DocumentStoragePort
  ) {}

  async execute(request: CreateReportRequest) {
    const user = await this.userRepository.getById(request.agentId);
    assertHasRole(user, 'agent', 'Only agents can file reports');

    const { plateNumber, location, photos, address } = request;

    if (!plateNumber || !isValidPlateFormat(plateNumber)) {
      throw new DomainError('INVALID_ARGUMENT', 'Valid license plate number is required');
    }

    const hasLocation =
      location != null &&
      typeof location.lat === 'number' &&
      typeof location.lng === 'number';
    const hasAddress = typeof address === 'string' && address.trim().length > 0;

    if (!hasLocation && !hasAddress) {
      throw new DomainError('INVALID_ARGUMENT', 'Either GPS location or address is required');
    }

    if (!Array.isArray(photos) || photos.length < 2 || photos.length > 3) {
      throw new DomainError('INVALID_ARGUMENT', 'Reports must include 2 or 3 evidence photos');
    }

    const seenPaths = new Set<string>();
    const seenSlots = new Set<ReportPhotoSlot>();
    const normalizedPhotos: ReportPhoto[] = [];

    for (const item of photos) {
      if (!item || typeof item.slot !== 'string' || !VALID_SLOTS.has(item.slot as ReportPhotoSlot)) {
        throw new DomainError('INVALID_ARGUMENT', 'Invalid photo slot');
      }
      if (!isValidReportPath(item.path, request.agentId)) {
        throw new DomainError('INVALID_ARGUMENT', 'Invalid report photo storage path');
      }
      if (seenPaths.has(item.path)) {
        throw new DomainError('INVALID_ARGUMENT', 'Duplicate photo paths are not allowed');
      }
      if (seenSlots.has(item.slot)) {
        throw new DomainError('INVALID_ARGUMENT', 'Duplicate photo slots are not allowed');
      }
      seenPaths.add(item.path);
      seenSlots.add(item.slot);
      normalizedPhotos.push({ path: item.path.trim(), slot: item.slot });
    }

    if (!seenSlots.has('context') || !seenSlots.has('plate')) {
      throw new DomainError('INVALID_ARGUMENT', 'Both context and plate photos are required');
    }

    const checks = await Promise.all(
      normalizedPhotos.map((photo) => this.storagePort.verifyRasterImage(photo.path))
    );
    if (checks.some((valid) => !valid)) {
      throw new DomainError(
        'INVALID_ARGUMENT',
        'All report photos must exist in storage as valid JPEG, PNG, or WebP images under 1.5 MB'
      );
    }

    const report: Omit<Report, 'id'> = {
      agentId: request.agentId,
      plateNumber: String(plateNumber).toUpperCase().trim(),
      location: location ?? null,
      photos: normalizedPhotos,
      address: typeof address === 'string' ? address.trim() : '',
      status: 'pending',
      timestamp: new Date(),
    };

    const reportId = await this.reportRepository.create(report);
    logger.info('Report created', {
      reportId,
      actorId: request.agentId,
      action: 'CREATE_REPORT',
      photoCount: normalizedPhotos.length,
    });

    return { ok: true, reportId };
  }
}
