import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ApproveTransferUseCase } from '../../../application/usecases/car/approve-transfer';
import { carRepository, fineRepository } from '../index';

const approveTransferUseCase = new ApproveTransferUseCase(carRepository, fineRepository);

export const approveTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await approveTransferUseCase.execute({
        actorId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
