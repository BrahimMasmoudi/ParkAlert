import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CheckPlateAvailabilityUseCase } from '../../../application/usecases/car/check-plate';
import { carRepository } from '../index';

const checkPlateAvailabilityUseCase = new CheckPlateAvailabilityUseCase(carRepository);

export const checkPlate = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await checkPlateAvailabilityUseCase.execute(request.data.plateNumber);
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
