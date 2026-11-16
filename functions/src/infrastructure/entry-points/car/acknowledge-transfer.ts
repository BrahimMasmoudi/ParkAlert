import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { AcknowledgeTransferUseCase } from '../../../application/usecases/car/acknowledge-transfer';
import { carRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const acknowledgeTransferUseCase = new AcknowledgeTransferUseCase(
  carRepository,
  userRepository,
  transactionRunner
);

export const acknowledgeTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await acknowledgeTransferUseCase.execute({
        ...(request.data ?? {}),
        ownerId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
