import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ApproveCarDeletionUseCase } from '../../../application/usecases/car/approve-car-deletion';
import { carRepository, userRepository } from '../index';

const approveCarDeletionUseCase = new ApproveCarDeletionUseCase(carRepository, userRepository);

export const approveCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await approveCarDeletionUseCase.execute({
        actorId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
