import * as logger from 'firebase-functions/logger';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { validateRejectionReason } from '../../../domain/value-objects/plate';

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
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: DismissReportRequest): Promise<{ ok: true }> {
    const { reportId, reason, actorId } = request;
    if (!reportId || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'reportId and actorId are required');
    }
    const cleanReason = validateRejectionReason(reason);

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      if (!actor || actor.role !== 'police') {
        throw new DomainError('PERMISSION_DENIED', 'Only police officers can dismiss reports');
      }

      const report = await this.reportRepository.getById(reportId, tx);
      if (!report) {
        throw new DomainError('NOT_FOUND', 'Report not found');
      }
      if (report.status !== 'pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Only pending reports can be dismissed');
      }

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

      logger.info('Report dismissed', {
        reportId,
        actorId,
        action: 'DISMISS_REPORT',
      });

      return { ok: true };
    });
  }
}
