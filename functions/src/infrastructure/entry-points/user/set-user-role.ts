import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { SetUserRoleUseCase } from '../../../application/usecases/user/set-user-role';
import { userRepository } from '../index';

const setUserRoleUseCase = new SetUserRoleUseCase(userRepository);

export const setUserRole = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      const { role, name, email, phone } = request.data;
      return await setUserRoleUseCase.execute({
        uid: request.auth.uid,
        role,
        name,
        email: email ?? request.auth!.token['email'],
        phone,
        photoURL: request.auth!.token['picture'] as string,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
