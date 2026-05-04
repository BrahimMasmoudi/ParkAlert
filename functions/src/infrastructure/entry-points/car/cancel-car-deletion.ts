import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CancelCarDeletionUseCase } from '../../../application/usecases/car/cancel-car-deletion';
import { carRepository } from '../index';

const cancelCarDeletionUseCase = new CancelCarDeletionUseCase(carRepository);

export const cancelCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await cancelCarDeletionUseCase.execute({
        userId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
