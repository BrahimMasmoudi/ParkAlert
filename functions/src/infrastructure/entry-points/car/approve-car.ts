import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ApproveCarUseCase } from '../../../application/usecases/car/approve-car';
import { carRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const approveCarUseCase = new ApproveCarUseCase(carRepository, userRepository, transactionRunner);

export const approveCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await approveCarUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
