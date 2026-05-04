import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { PayFineUseCase } from '../../../application/usecases/fine/pay-fine';
import { fineRepository, reportRepository, connector } from '../index';

const payFineUseCase = new PayFineUseCase(fineRepository, reportRepository);

export const payFine = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const batch = connector.getBatch();
    try {
      const result = await payFineUseCase.execute({
        userId: request.auth.uid,
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
