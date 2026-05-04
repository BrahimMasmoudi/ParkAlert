import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { IssueFineUseCase } from '../../../application/usecases/fine/issue-fine';
import { fineRepository, reportRepository, userRepository, connector } from '../index';

const issueFineUseCase = new IssueFineUseCase(reportRepository, fineRepository, userRepository);

export const issueFine = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const batch = connector.getBatch();
    try {
      const result = await issueFineUseCase.execute({
        issuedBy: request.auth.uid,
        ...request.data,
        batch,
      });
      await batch.commit();
      return result;
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
