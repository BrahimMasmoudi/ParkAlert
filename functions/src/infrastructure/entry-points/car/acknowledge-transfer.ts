import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { AcknowledgeTransferUseCase } from '../../../application/usecases/car/acknowledge-transfer';
import { carRepository } from '../index';

const acknowledgeTransferUseCase = new AcknowledgeTransferUseCase(carRepository);

export const acknowledgeTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await acknowledgeTransferUseCase.execute({
        ownerId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
