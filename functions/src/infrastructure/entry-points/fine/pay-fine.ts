import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { PayFineUseCase } from '../../../application/usecases/fine/pay-fine';
import { CardBrand } from '../../../domain/value-objects/payment';
import {
  enforcementAuditPort,
  fineRepository,
  reportRepository,
  transactionRunner,
} from '../index';
import { mapDomainErrorToHttpsError } from '../shared/error-mapper';

const ALLOWED_PAY_FINE_KEYS = new Set([
  'fineId',
  'cardholderName',
  'cardBrand',
  'cardLast4',
  'paymentAttemptId',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const payFineUseCase = new PayFineUseCase(
  fineRepository,
  reportRepository,
  enforcementAuditPort,
  transactionRunner
);

export const payFine = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    try {
      if (!isPlainObject(request.data)) {
        throw new HttpsError('invalid-argument', 'Invalid payment payload');
      }

      for (const key of Object.keys(request.data)) {
        if (!ALLOWED_PAY_FINE_KEYS.has(key)) {
          throw new HttpsError('invalid-argument', 'Invalid payment payload');
        }
      }

      return await payFineUseCase.execute({
        fineId: request.data.fineId as string,
        userId: request.auth.uid,
        cardholderName: request.data.cardholderName as string,
        cardBrand: request.data.cardBrand as CardBrand,
        cardLast4: request.data.cardLast4 as string,
        paymentAttemptId: request.data.paymentAttemptId as string,
      });
    } catch (error) {
      throw mapDomainErrorToHttpsError(error);
    }
  }
);
