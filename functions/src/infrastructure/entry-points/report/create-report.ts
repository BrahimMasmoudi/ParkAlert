import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CreateReportUseCase } from '../../../application/usecases/report/create-report';
import { reportRepository, userRepository } from '../index';

const createReportUseCase = new CreateReportUseCase(reportRepository, userRepository);

export const createReport = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await createReportUseCase.execute({
        agentId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
