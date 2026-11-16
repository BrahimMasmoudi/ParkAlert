import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RequestCarDeletionUseCase } from '../../../application/usecases/car/request-car-deletion';
import { carRepository, fineRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const requestCarDeletionUseCase = new RequestCarDeletionUseCase(
  carRepository,
  fineRepository,
  userRepository,
  transactionRunner
);

export const requestCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await requestCarDeletionUseCase.execute({
        ...(request.data ?? {}),
        userId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
