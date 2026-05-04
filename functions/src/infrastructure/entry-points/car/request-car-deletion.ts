import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RequestCarDeletionUseCase } from '../../../application/usecases/car/request-car-deletion';
import { carRepository } from '../index';

const requestCarDeletionUseCase = new RequestCarDeletionUseCase(carRepository);

export const requestCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await requestCarDeletionUseCase.execute({
        userId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
