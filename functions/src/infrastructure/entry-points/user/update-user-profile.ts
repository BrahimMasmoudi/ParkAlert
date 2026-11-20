import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { UpdateUserProfileUseCase } from '../../../application/usecases/user/update-user-profile';
import { userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const updateUserProfileUseCase = new UpdateUserProfileUseCase(userRepository);

export const updateUserProfile = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await updateUserProfileUseCase.execute({
        ...(request.data ?? {}),
        uid: request.auth.uid,
      });
    } catch (error: unknown) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
