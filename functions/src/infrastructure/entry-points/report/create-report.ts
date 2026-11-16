import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CreateReportUseCase } from '../../../application/usecases/report/create-report';
import { documentStoragePort, reportRepository, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const createReportUseCase = new CreateReportUseCase(
  reportRepository,
  userRepository,
  documentStoragePort
);

export const createReport = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await createReportUseCase.execute({
        ...(request.data ?? {}),
        agentId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
