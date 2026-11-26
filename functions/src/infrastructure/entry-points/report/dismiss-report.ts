import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { DismissReportUseCase } from '../../../application/usecases/report/dismiss-report';
import {
  carRepository,
  enforcementAuditPort,
  policeAuditPort,
  reportRepository,
  transactionRunner,
  userRepository,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const dismissReportUseCase = new DismissReportUseCase(
  reportRepository,
  userRepository,
  enforcementAuditPort,
  transactionRunner,
  carRepository,
  policeAuditPort
);

export const dismissReport = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await dismissReportUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
