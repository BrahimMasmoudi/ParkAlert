import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RejectCarUseCase } from '../../../application/usecases/car/reject-car';
import { carRepository } from '../index';

const rejectCarUseCase = new RejectCarUseCase(carRepository);

export const rejectCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await rejectCarUseCase.execute({
        actorId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
