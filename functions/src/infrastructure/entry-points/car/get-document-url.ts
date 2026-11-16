import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GetDocumentUrlUseCase } from '../../../application/usecases/car/get-document-url';
import { carRepository, documentStoragePort, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const getDocumentUrlUseCase = new GetDocumentUrlUseCase(
  carRepository,
  userRepository,
  documentStoragePort
);

export const getDocumentUrl = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await getDocumentUrlUseCase.execute({
        ...(request.data ?? {}),
        callerId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
