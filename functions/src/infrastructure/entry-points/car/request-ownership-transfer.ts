import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RequestOwnershipTransferUseCase } from '../../../application/usecases/car/request-ownership-transfer';
import { carRepository, fineRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const requestOwnershipTransferUseCase = new RequestOwnershipTransferUseCase(
  carRepository,
  fineRepository,
  userRepository,
  transactionRunner
);

export const requestOwnershipTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await requestOwnershipTransferUseCase.execute({
        ...(request.data ?? {}),
        receiverId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
