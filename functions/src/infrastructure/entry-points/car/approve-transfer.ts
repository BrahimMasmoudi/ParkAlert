import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ApproveTransferUseCase } from '../../../application/usecases/car/approve-transfer';
import {
  carRepository,
  fineRepository,
  policeAuditPort,
  transactionRunner,
  userRepository,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const approveTransferUseCase = new ApproveTransferUseCase(
  carRepository,
  fineRepository,
  userRepository,
  transactionRunner,
  policeAuditPort
);

export const approveTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await approveTransferUseCase.execute({
        ...(request.data ?? {}),
        actorId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
