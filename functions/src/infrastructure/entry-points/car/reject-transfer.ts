import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RejectTransferUseCase } from '../../../application/usecases/car/reject-transfer';
import { carRepository } from '../index';

const rejectTransferUseCase = new RejectTransferUseCase(carRepository);

export const rejectTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await rejectTransferUseCase.execute({
        actorId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
