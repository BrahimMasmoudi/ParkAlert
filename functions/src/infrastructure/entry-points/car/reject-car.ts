import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RejectCarUseCase } from '../../../application/usecases/car/reject-car';
import { carRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const rejectCarUseCase = new RejectCarUseCase(carRepository, userRepository, transactionRunner);

export const rejectCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await rejectCarUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
