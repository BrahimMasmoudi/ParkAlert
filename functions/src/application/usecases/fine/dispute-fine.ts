import * as logger from 'firebase-functions/logger';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { EnforcementAuditPort } from '../../../domain/repositories/enforcement-audit.port';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { DomainError } from '../../../domain/errors/domain.error';
import { validateRejectionReason } from '../../../domain/value-objects/plate';

export interface DisputeFineRequest {
  fineId: string;
  reason: string;
  actorId: string;
}

/**
 * Allows the fined vehicle owner to submit a single-step dispute explanation on an unpaid fine.
 */
export class DisputeFineUseCase {
  constructor(
    private readonly fineRepository: FineRepository,
    private readonly enforcementAuditPort: EnforcementAuditPort,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: DisputeFineRequest): Promise<{ ok: true }> {
    const { fineId, reason, actorId } = request;
    if (!fineId || !actorId) {
      throw new DomainError('INVALID_ARGUMENT', 'fineId and actorId are required');
    }

    const cleanReason = validateRejectionReason(reason);

    return this.transactionRunner.run(async (tx) => {
      const fine = await this.fineRepository.getById(fineId, tx);
      if (!fine) {
        throw new DomainError('NOT_FOUND', 'Fine not found');
      }

      if (fine.ownerId !== actorId) {
        throw new DomainError('PERMISSION_DENIED', 'You can only dispute your own fines');
      }

      if (fine.status !== 'unpaid') {
        throw new DomainError('FAILED_PRECONDITION', 'Only unpaid fines can be disputed');
      }

      if ((fine.disputeStatus ?? 'none') !== 'none') {
        throw new DomainError('FAILED_PRECONDITION', 'This fine has already been disputed');
      }

      await this.fineRepository.update(
        fineId,
        {
          disputeStatus: 'pending',
          disputeReason: cleanReason,
          disputedAt: new Date(),
        },
        tx
      );

      await this.enforcementAuditPort.addAuditLog(
        {
          targetType: 'fine',
          targetId: fineId,
          actorId,
          action: 'DISPUTE_FINE',
          reason: cleanReason,
          timestamp: new Date(),
        },
        tx
      );

      logger.info('Fine disputed', {
        fineId,
        reportId: fine.reportId,
        actorId,
        action: 'DISPUTE_FINE',
      });

      return { ok: true };
    });
  }
}
