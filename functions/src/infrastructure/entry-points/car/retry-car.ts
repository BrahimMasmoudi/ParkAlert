import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RetryCarUseCase } from '../../../application/usecases/car/retry-car';
import { carRepository } from '../index';

const retryCarUseCase = new RetryCarUseCase(carRepository);

export const retryCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await retryCarUseCase.execute({
        userId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
