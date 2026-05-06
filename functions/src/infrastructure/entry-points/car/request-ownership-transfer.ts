import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RequestOwnershipTransferUseCase } from '../../../application/usecases/car/request-ownership-transfer';
import { carRepository, fineRepository } from '../index';

const requestOwnershipTransferUseCase = new RequestOwnershipTransferUseCase(carRepository, fineRepository);

export const requestOwnershipTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await requestOwnershipTransferUseCase.execute({
        receiverId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
