import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GetEvidenceUrlsUseCase } from '../../../application/usecases/evidence/get-evidence-urls';
import {
  documentStoragePort,
  fineRepository,
  reportRepository,
  userRepository,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const getEvidenceUrlsUseCase = new GetEvidenceUrlsUseCase(
  reportRepository,
  fineRepository,
  userRepository,
  documentStoragePort
);

export const getEvidenceUrls = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await getEvidenceUrlsUseCase.execute({
        ...(request.data ?? {}),
        callerId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
