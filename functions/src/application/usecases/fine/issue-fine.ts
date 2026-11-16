import * as logger from 'firebase-functions/logger';
import { CarRepository } from '../../../domain/repositories/car.repository';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { Fine } from '../../../domain/entities/fine.entity';
import { Report } from '../../../domain/entities/report.entity';
import { DomainError } from '../../../domain/errors/domain.error';
import { normalizePlate } from '../../../domain/value-objects/plate';

export interface IssueFineRequest {
  reportId: string;
  ownerId: string;
  plateNumber: string;
  expectedPlateNumber?: string;
  amount: number;
  notes?: string;
  issuedBy: string;
}

export class IssueFineUseCase {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly fineRepository: FineRepository,
    private readonly userRepository: UserRepository,
    private readonly carRepository: CarRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly enforcementAuditPort?: EnforcementAuditPort
  ) {}

  async execute(request: IssueFineRequest) {
    const { reportId, ownerId, plateNumber, expectedPlateNumber, amount, notes, issuedBy } = request;
    if (!reportId || !ownerId || !plateNumber || !amount || Number(amount) <= 0 || !issuedBy) {
      throw new DomainError('INVALID_ARGUMENT', 'reportId, ownerId, plateNumber, valid amount, and issuedBy are required');
    }

    const normalizedPlate = normalizePlate(plateNumber);
    if (!normalizedPlate) {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid plateNumber');
    }

    return this.transactionRunner.run(async (tx) => {
      const caller = await this.userRepository.getById(issuedBy, tx);
      if (!caller || caller.role !== 'police') {
        throw new DomainError('PERMISSION_DENIED', 'Only police officers can issue fines');
      }

      const report = await this.reportRepository.getById(reportId, tx);
      if (!report) {
        throw new DomainError('NOT_FOUND', 'Report not found');
      }
      if (report.status !== 'pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Report has already been processed');
      }
      if (
        expectedPlateNumber !== undefined &&
        normalizePlate(expectedPlateNumber) !== normalizePlate(report.plateNumber)
      ) {
        throw new DomainError(
          'FAILED_PRECONDITION',
          'Report plate changed concurrently; reload the report and verify again'
        );
      }

      const car = await this.carRepository.getByPlateNumber(plateNumber, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Vehicle not found for fine issuance');
      }
      if (car.ownerId !== ownerId) {
        throw new DomainError('FAILED_PRECONDITION', 'Vehicle ownership has changed; fine ownerId does not match current owner');
      }
      if (car.status === 'archived' || car.status === 'rejected') {
        throw new DomainError('FAILED_PRECONDITION', 'Cannot issue fine for an archived or rejected vehicle');
      }

      const issuedPlateFormatted = String(plateNumber).toUpperCase().trim();
      const officerChanged = normalizedPlate !== normalizePlate(report.plateNumber);
      const earliestOriginal = report.originalPlateNumber ?? (officerChanged ? report.plateNumber : undefined);

      const reportUpdates: Partial<Report> = {
        status: 'investigated',
      };
      if (officerChanged) {
        reportUpdates.plateNumber = issuedPlateFormatted;
        reportUpdates.originalPlateNumber = earliestOriginal;
        reportUpdates.plateCorrectedBy = issuedBy;
        reportUpdates.plateCorrectedAt = new Date();
      }
      await this.reportRepository.update(reportId, reportUpdates, tx);

      const fine: Omit<Fine, 'id'> = {
        reportId,
        ownerId,
        plateNumber: issuedPlateFormatted,
        plateNumberNormalized: normalizedPlate,
        amount: Number(amount),
        status: 'unpaid',
        disputeStatus: 'none',
        evidencePhotos: report.photos ?? [],
        ...(earliestOriginal
          ? {
              originalPlateNumber: earliestOriginal,
              plateCorrectedBy: officerChanged ? issuedBy : report.plateCorrectedBy,
              plateCorrectedAt: officerChanged ? new Date() : report.plateCorrectedAt,
            }
          : {}),
        notes: notes ?? '',
        issuedBy,
        issuedAt: new Date(),
      };

      const fineId = await this.fineRepository.create(fine, tx);

      if (this.enforcementAuditPort) {
        await this.enforcementAuditPort.addAuditLog(
          {
            targetType: 'fine',
            targetId: fineId,
            actorId: issuedBy,
            action: 'ISSUE_FINE',
            originalPlate: earliestOriginal ?? report.plateNumber,
            issuedPlate: issuedPlateFormatted,
            timestamp: new Date(),
          },
          tx
        );
      }

      logger.info('Fine issued', {
        reportId,
        fineId,
        actorId: issuedBy,
        action: 'ISSUE_FINE',
        photoCount: fine.evidencePhotos?.length ?? 0,
        plateCorrected: Boolean(earliestOriginal),
      });

      return { ok: true, fineId };
    });
  }
}
