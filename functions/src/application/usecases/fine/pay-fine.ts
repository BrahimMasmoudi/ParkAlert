import * as logger from 'firebase-functions/logger';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import {
  CardBrand,
  generatePaymentReference,
  validateCardBrand,
  validateCardLast4,
  validateCardholderName,
  validatePaymentAttemptId,
} from '../../../domain/value-objects/payment';

export interface PayFineRequest {
  fineId: string;
  userId: string;
  cardholderName: string;
  cardBrand: CardBrand;
  cardLast4: string;
  paymentAttemptId: string;
}

/**
 * Pays an unpaid fine inside a transaction, supporting idempotent retries via paymentAttemptId,
 * recording owner-only receipt card summary metadata, and closing any linked report as resolved.
 */
export class PayFineUseCase {
  constructor(
    private readonly fineRepository: FineRepository,
    private readonly reportRepository: ReportRepository,
    private readonly enforcementAuditPort: EnforcementAuditPort,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: PayFineRequest): Promise<{ ok: true; paymentReference: string }> {
    const fineId = typeof request.fineId === 'string' ? request.fineId.trim() : '';
    const userId = typeof request.userId === 'string' ? request.userId.trim() : '';
    if (!fineId || !userId) {
      throw new DomainError('INVALID_ARGUMENT', 'fineId and userId are required');
    }

    const cardholderName = validateCardholderName(request.cardholderName);
    const cardBrand = validateCardBrand(request.cardBrand);
    const cardLast4 = validateCardLast4(request.cardLast4);
    const paymentAttemptId = validatePaymentAttemptId(request.paymentAttemptId);

    return this.transactionRunner.run(async (tx) => {
      const fine = await this.fineRepository.getById(fineId, tx);
      if (!fine) {
        throw new DomainError('NOT_FOUND', 'Fine not found');
      }

      if (fine.ownerId !== userId) {
        throw new DomainError('PERMISSION_DENIED', 'You can only pay your own fines');
      }
      if (fine.status === 'cancelled') {
        throw new DomainError('FAILED_PRECONDITION', 'Cancelled fines cannot be paid');
      }
      if (fine.disputeStatus === 'pending') {
        throw new DomainError('FAILED_PRECONDITION', 'Fines under active dispute cannot be paid');
      }
      if (fine.status === 'paid') {
        if (fine.paymentAttemptId === paymentAttemptId && fine.paymentReference) {
          return { ok: true, paymentReference: fine.paymentReference };
        }
        throw new DomainError('FAILED_PRECONDITION', 'This fine is already paid');
      }

      const linkedReport = fine.reportId
        ? await this.reportRepository.getById(fine.reportId, tx)
        : null;

      const paymentReference = generatePaymentReference();

      await this.fineRepository.update(
        fineId,
        {
          status: 'paid',
          paymentReference,
          paymentProvider: 'simulated',
          paymentAttemptId,
        },
        tx
      );

      await this.fineRepository.setReceiptSummary(
        fineId,
        {
          cardholderName,
          cardBrand,
          cardLast4,
        },
        tx
      );

      if (linkedReport && fine.reportId) {
        await this.reportRepository.updateStatus(fine.reportId, 'resolved', tx);
      }

      await this.enforcementAuditPort.addAuditLog(
        {
          targetType: 'fine',
          targetId: fineId,
          actorId: userId,
          action: 'PAY_FINE',
          paymentReference,
          paymentProvider: 'simulated',
          timestamp: new Date(),
        },
        tx
      );

      logger.info('Fine paid', {
        fineId,
        reportId: fine.reportId,
        actorId: userId,
        action: 'PAY_FINE',
        paymentReference,
        paymentProvider: 'simulated',
        paymentAttemptId,
      });

      return { ok: true, paymentReference };
    });
  }
}
