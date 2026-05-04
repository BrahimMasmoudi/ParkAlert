import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ApproveCarUseCase } from '../../../application/usecases/car/approve-car';
import { carRepository } from '../index';

const approveCarUseCase = new ApproveCarUseCase(carRepository);

export const approveCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await approveCarUseCase.execute({
        actorId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
