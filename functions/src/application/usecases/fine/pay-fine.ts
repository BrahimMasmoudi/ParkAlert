import * as logger from 'firebase-functions/logger';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';

export interface PayFineRequest {
  fineId: string;
  userId: string;
}

/**
 * Pays an unpaid fine inside a transaction, blocking cancelled and pending-dispute fines
 * and closing any linked report as resolved.
 */
export class PayFineUseCase {
  constructor(
    private readonly fineRepository: FineRepository,
    private readonly reportRepository: ReportRepository,
    private readonly enforcementAuditPort: EnforcementAuditPort,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: PayFineRequest): Promise<{ ok: true }> {
    const { fineId, userId } = request;
    if (!fineId || !userId) {
      throw new DomainError('INVALID_ARGUMENT', 'fineId and userId are required');
    }

    return this.transactionRunner.run(async (tx) => {
      const fine = await this.fineRepository.getById(fineId, tx);
      if (!fine) {
        throw new DomainError('NOT_FOUND', 'Fine not found');
      }

      if (fine.ownerId !== userId) {
        throw new DomainError('PERMISSION_DENIED', 'You can only pay your own fines');
      }
      if (fine.status === 'paid') {
        throw new DomainError('FAILED_PRECONDITION', 'This fine is already paid');
      }
      if (fine.status === 'cancelled') {
        throw new DomainError('FAILED_PRECONDITION', 'Cancelled fines cannot be paid');
      }
      if (fine.disputeStatus === 'pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Fines under active dispute cannot be paid');
      }

      const linkedReport = fine.reportId
        ? await this.reportRepository.getById(fine.reportId, tx)
        : null;

      await this.fineRepository.update(fineId, { status: 'paid' }, tx);

      if (linkedReport && fine.reportId) {
        await this.reportRepository.updateStatus(fine.reportId, 'resolved', tx);
      }

      await this.enforcementAuditPort.addAuditLog(
        {
          targetType: 'fine',
          targetId: fineId,
          actorId: userId,
          action: 'PAY_FINE',
          timestamp: new Date(),
        },
        tx
      );

      logger.info('Fine paid', {
        fineId,
        reportId: fine.reportId,
        actorId: userId,
        action: 'PAY_FINE',
      });

      return { ok: true };
    });
  }
}
