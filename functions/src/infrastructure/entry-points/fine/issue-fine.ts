import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { IssueFineUseCase } from '../../../application/usecases/fine/issue-fine';
import {
  carRepository,
  enforcementAuditPort,
  fineRepository,
  reportRepository,
  transactionRunner,
  userRepository,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const issueFineUseCase = new IssueFineUseCase(
  reportRepository,
  fineRepository,
  userRepository,
  carRepository,
  transactionRunner,
  enforcementAuditPort
);

export const issueFine = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await issueFineUseCase.execute({
        ...(request.data ?? {}),
        issuedBy: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
