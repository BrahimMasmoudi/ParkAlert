import * as logger from 'firebase-functions/logger';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { validateRejectionReason } from '../../../domain/value-objects/plate';

export type ResolveDisputeAction = 'cancel_fine' | 'dismiss_dispute';

export interface ResolveDisputeRequest {
  fineId: string;
  action: ResolveDisputeAction;
  reason: string;
  actorId: string;
}

/**
 * Allows police officers to resolve a pending fine dispute by either cancelling the fine
 * (and closing any linked report) or rejecting the dispute so payment remains required.
 */
export class ResolveDisputeUseCase {
  constructor(
    private readonly fineRepository: FineRepository,
    private readonly reportRepository: ReportRepository,
    private readonly userRepository: UserRepository,
    private readonly enforcementAuditPort: EnforcementAuditPort,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: ResolveDisputeRequest): Promise<{ ok: true }> {
    const { fineId, action, reason, actorId } = request;
    if (!fineId || !actorId || (action !== 'cancel_fine' && action !== 'dismiss_dispute')) {
      throw new DomainError(
        'INVALID_ARGUMENT',
        'fineId, actorId, and valid action (cancel_fine | dismiss_dispute) are required'
      );
    }

    const cleanReason = validateRejectionReason(reason);

    return this.transactionRunner.run(async (tx) => {
      const actor = await this.userRepository.getById(actorId, tx);
      if (!actor || actor.role !== 'police') {
        throw new DomainError('PERMISSION_DENIED', 'Only police officers can resolve disputes');
      }

      const fine = await this.fineRepository.getById(fineId, tx);
      if (!fine) {
        throw new DomainError('NOT_FOUND', 'Fine not found');
      }

      if (fine.status !== 'unpaid' || fine.disputeStatus !== 'pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Only unpaid fines with a pending dispute can be resolved');
      }

      const linkedReport =
        action === 'cancel_fine' && fine.reportId
          ? await this.reportRepository.getById(fine.reportId, tx)
          : null;

      if (action === 'cancel_fine') {
        await this.fineRepository.update(
          fineId,
          {
            status: 'cancelled',
            disputeStatus: 'accepted',
            resolutionReason: cleanReason,
            resolvedBy: actorId,
            resolvedAt: new Date(),
          },
          tx
        );

        if (linkedReport && fine.reportId) {
          await this.reportRepository.update(
            fine.reportId,
            {
              status: 'resolved',
              resolutionReason: 'fine_cancelled',
              resolvedBy: actorId,
              resolvedAt: new Date(),
            },
            tx
          );
        }

        await this.enforcementAuditPort.addAuditLog(
          {
            targetType: 'fine',
            targetId: fineId,
            actorId,
            action: 'CANCEL_FINE',
            reason: cleanReason,
            timestamp: new Date(),
          },
          tx
        );

        logger.info('Fine cancelled from dispute', {
          fineId,
          reportId: fine.reportId,
          actorId,
          action: 'CANCEL_FINE',
        });
      } else {
        await this.fineRepository.update(
          fineId,
          {
            disputeStatus: 'rejected',
            resolutionReason: cleanReason,
            resolvedBy: actorId,
            resolvedAt: new Date(),
          },
          tx
        );

        await this.enforcementAuditPort.addAuditLog(
          {
            targetType: 'fine',
            targetId: fineId,
            actorId,
            action: 'DISMISS_DISPUTE',
            reason: cleanReason,
            timestamp: new Date(),
          },
          tx
        );

        logger.info('Fine dispute dismissed', {
          fineId,
          reportId: fine.reportId,
          actorId,
          action: 'DISMISS_DISPUTE',
        });
      }

      return { ok: true };
    });
  }
}
