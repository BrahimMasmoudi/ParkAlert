import * as logger from 'firebase-functions/logger';
import { Car } from '../../../domain/entities/car.entity';
import { CarRepository } from '../../../domain/repositories/car.repository';
import { PoliceAuditPort } from '../../../domain/repositories/police-audit.port';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { normalizePlate, validateRejectionReason } from '../../../domain/value-objects/plate';
import {
  assertHasRole,
  assertNotSelfEnforcement,
} from '../shared/user-authorization';

export interface DismissReportRequest {
  reportId: string;
  reason: string;
  actorId: string;
}

/**
 * Allows police officers to close a pending report as resolved without issuing a fine
 * when photos are unreadable or the vehicle plate is unregistered.
 */
export class DismissReportUseCase {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly userRepository: UserRepository,
    private readonly enforcementAuditPort: EnforcementAuditPort,
    private readonly transactionRunner: TransactionRunner,
    private readonly carRepository: CarRepository,
    private readonly policeAuditPort: PoliceAuditPort
  ) {}

  async execute(request: DismissReportRequest): Promise<{ ok: true }> {
    const { reportId, reason, actorId } = request;
    if (!reportId || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'reportId and actorId are required');
    }
    const cleanReason = validateRejectionReason(reason);

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      assertHasRole(actor, 'police', 'Only police officers can dismiss reports');

      const report = await this.reportRepository.getById(reportId, tx);
      if (!report) {
        throw new DomainError('NOT_FOUND', 'Report not found');
      }
      if (report.status !== 'pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Only pending reports can be dismissed');
      }

      const carsByNormalizedPlate = new Map<string, Car[]>();
      const plateOwnerIds: string[] = [];
      for (const rawPlate of [report.plateNumber, report.originalPlateNumber]) {
        const normalized = normalizePlate(rawPlate || '');
        if (!normalized || carsByNormalizedPlate.has(normalized)) continue;

        const cars = await this.carRepository.getAllByPlateNumber(rawPlate!, tx, {
          includeRejected: true,
          includeArchived: true,
        });
        carsByNormalizedPlate.set(normalized, cars);
        for (const car of cars) {
          if (car.ownerId) plateOwnerIds.push(car.ownerId);
          if (car.transferToOwnerId) plateOwnerIds.push(car.transferToOwnerId);
        }
      }

      assertNotSelfEnforcement(actorId, plateOwnerIds, {
        targetType: 'report',
        targetId: reportId,
      });

      const normalizedReportPlate = normalizePlate(report.plateNumber || '');
      const reportCars = normalizedReportPlate
        ? (carsByNormalizedPlate.get(normalizedReportPlate) ?? [])
        : [];
      const eligibleCars = reportCars.filter(
        (car) => car.status !== 'archived' && car.status !== 'rejected'
      );
      const attributedCar = eligibleCars.find((car) => car.status === 'active') ?? eligibleCars[0];

      await this.reportRepository.update(
        reportId,
        {
          status: 'resolved',
          resolutionReason: cleanReason,
          resolvedBy: actorId,
          resolvedAt: new Date(),
        },
        tx
      );

      await this.enforcementAuditPort.addAuditLog(
        {
          targetType: 'report',
          targetId: reportId,
          actorId,
          action: 'DISMISS_REPORT',
          reason: cleanReason,
          timestamp: new Date(),
        },
        tx
      );

      await this.policeAuditPort.addLog(
        {
          targetType: 'report',
          targetId: reportId,
          actorId,
          ownerId: attributedCar?.ownerId ?? '',
          plateNumber: report.plateNumber ?? '',
          plateNumberNormalized: normalizedReportPlate,
          action: 'DISMISS_REPORT',
          reason: cleanReason?.trim() || null,
        },
        tx
      );

      logger.info('Report dismissed', {
        reportId,
        actorId,
        action: 'DISMISS_REPORT',
      });

      return { ok: true };
    });
  }
}
