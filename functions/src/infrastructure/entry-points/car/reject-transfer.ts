import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RejectTransferUseCase } from '../../../application/usecases/car/reject-transfer';
import { carRepository, policeAuditPort, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const rejectTransferUseCase = new RejectTransferUseCase(
  carRepository,
  userRepository,
  transactionRunner,
  policeAuditPort
);

export const rejectTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await rejectTransferUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
