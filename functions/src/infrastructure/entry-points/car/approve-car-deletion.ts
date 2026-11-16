import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ApproveCarDeletionUseCase } from '../../../application/usecases/car/approve-car-deletion';
import { carRepository, fineRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const approveCarDeletionUseCase = new ApproveCarDeletionUseCase(
  carRepository,
  fineRepository,
  userRepository,
  transactionRunner
);

export const approveCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await approveCarDeletionUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
