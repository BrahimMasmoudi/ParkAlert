import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { PayFineUseCase } from '../../../application/usecases/fine/pay-fine';
import {
  enforcementAuditPort,
  fineRepository,
  reportRepository,
  transactionRunner,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const payFineUseCase = new PayFineUseCase(
  fineRepository,
  reportRepository,
  enforcementAuditPort,
  transactionRunner
);

export const payFine = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await payFineUseCase.execute({
        ...(request.data ?? {}),
        userId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
