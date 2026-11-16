import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CancelCarDeletionUseCase } from '../../../application/usecases/car/cancel-car-deletion';
import { carRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const cancelCarDeletionUseCase = new CancelCarDeletionUseCase(
  carRepository,
  userRepository,
  transactionRunner
);

export const cancelCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await cancelCarDeletionUseCase.execute({
        ...(request.data ?? {}),
        userId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
