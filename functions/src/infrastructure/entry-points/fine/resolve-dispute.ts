import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ResolveDisputeUseCase } from '../../../application/usecases/fine/resolve-dispute';
import {
  enforcementAuditPort,
  fineRepository,
  policeAuditPort,
  reportRepository,
  transactionRunner,
  userRepository,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const resolveDisputeUseCase = new ResolveDisputeUseCase(
  fineRepository,
  reportRepository,
  userRepository,
  enforcementAuditPort,
  transactionRunner,
  policeAuditPort
);

export const resolveDispute = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await resolveDisputeUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
