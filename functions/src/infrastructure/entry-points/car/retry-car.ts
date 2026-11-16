import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RetryCarUseCase } from '../../../application/usecases/car/retry-car';
import { carRepository, transactionRunner, userRepository } from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const retryCarUseCase = new RetryCarUseCase(carRepository, userRepository, transactionRunner);

export const retryCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      const data = request.data ?? {};
      return await retryCarUseCase.execute({
        carId: data.carId,
        plateNumber: data.plateNumber,
        brand: data.brand,
        model: data.model,
        color: data.color,
        carteGriseUrl: data.carteGriseUrl,
        userId: request.auth.uid,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
