import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { UpdatePendingReportPlateUseCase } from '../../../application/usecases/report/update-report-plate';
import {
  enforcementAuditPort,
  reportRepository,
  transactionRunner,
  userRepository,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const updatePendingReportPlateUseCase = new UpdatePendingReportPlateUseCase(
  reportRepository,
  userRepository,
  enforcementAuditPort,
  transactionRunner
);

export const updatePendingReportPlate = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await updatePendingReportPlateUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
