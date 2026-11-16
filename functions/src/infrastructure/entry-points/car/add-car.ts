import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { AddCarUseCase } from '../../../application/usecases/car/add-car';
import { carRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const addCarUseCase = new AddCarUseCase(carRepository, userRepository, transactionRunner);

export const addCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      return await addCarUseCase.execute({
        ...(request.data ?? {}),
        userId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
