import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { DisputeFineUseCase } from '../../../application/usecases/fine/dispute-fine';
import {
  enforcementAuditPort,
  fineRepository,
  transactionRunner,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const disputeFineUseCase = new DisputeFineUseCase(
  fineRepository,
  enforcementAuditPort,
  transactionRunner
);

export const disputeFine = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await disputeFineUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
