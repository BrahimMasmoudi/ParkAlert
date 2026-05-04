import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { AddCarUseCase } from '../../../application/usecases/car/add-car';
import { carRepository, userRepository } from '../index';

const addCarUseCase = new AddCarUseCase(carRepository, userRepository);

export const addCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await addCarUseCase.execute({
        userId: request.auth.uid,
        ...request.data,
      });
    } catch (error: any) {
      throw new HttpsError('internal', error.message);
    }
  }
);
