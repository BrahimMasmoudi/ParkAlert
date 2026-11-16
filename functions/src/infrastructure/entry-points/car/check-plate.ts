import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CheckPlateAvailabilityUseCase } from '../../../application/usecases/car/check-plate';
import { carRepository, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const checkPlateAvailabilityUseCase = new CheckPlateAvailabilityUseCase(carRepository, userRepository);

export const checkPlate = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await checkPlateAvailabilityUseCase.execute({
        plateNumber: request.data?.plateNumber,
        callerId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
