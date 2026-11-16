import * as logger from 'firebase-functions/logger';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { isValidPlateFormat, normalizePlate } from '../../../domain/value-objects/plate';

export interface UpdatePendingReportPlateRequest {
  reportId: string;
  plateNumber: string;
  actorId: string;
}

/**
 * Allows the submitting agent to correct a mistyped plate while the report is still pending.
 */
export class UpdatePendingReportPlateUseCase {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly userRepository: UserRepository,
    private readonly enforcementAuditPort: EnforcementAuditPort,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: UpdatePendingReportPlateRequest): Promise<{ ok: true }> {
    const { reportId, plateNumber, actorId } = request;
    if (!reportId || !plateNumber || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'reportId, plateNumber, and actorId are required');
    }

    if (!isValidPlateFormat(plateNumber)) {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid license plate format');
    }

    const formattedPlate = String(plateNumber).toUpperCase().trim();

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      if (!actor || actor.role !== 'agent') {
        throw new DomainError('PERMISSION_DENIED', 'Only agents can edit pending report plates');
      }

      const report = await this.reportRepository.getById(reportId, tx);
      if (!report) {
        throw new DomainError('NOT_FOUND', 'Report not found');
      }
      if (report.agentId !== actorId) {
        throw new DomainError('PERMISSION_DENIED', 'Only the submitting agent can edit this report');
      }
      if (report.status !== 'pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Report is no longer pending');
      }

      if (normalizePlate(formattedPlate) === normalizePlate(report.plateNumber) && formattedPlate === report.plateNumber) {
        return { ok: true };
      }

      const earliestOriginal = report.originalPlateNumber ?? report.plateNumber;
      await this.reportRepository.update(
        reportId,
        {
          plateNumber: formattedPlate,
          originalPlateNumber: earliestOriginal,
          plateCorrectedBy: actorId,
          plateCorrectedAt: new Date(),
        },
        tx
      );

      await this.enforcementAuditPort.addAuditLog(
        {
          targetType: 'report',
          targetId: reportId,
          actorId,
          action: 'UPDATE_REPORT_PLATE',
          originalPlate: report.plateNumber,
          issuedPlate: formattedPlate,
          timestamp: new Date(),
        },
        tx
      );

      logger.info('Pending report plate updated', {
        reportId,
        actorId,
        action: 'UPDATE_REPORT_PLATE',
        plateCorrected: true,
      });

      return { ok: true };
    });
  }
}
