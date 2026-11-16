import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreConnector } from '../connectors/FirestoreConnector';
import { FirestoreReportRepository } from '../adapters/persistence/FirestoreReportRepository';
import { FirestoreUserRepository } from '../adapters/persistence/FirestoreUserRepository';
import { FirestoreFineRepository } from '../adapters/persistence/FirestoreFineRepository';
import { FirestoreCarRepository } from '../adapters/persistence/FirestoreCarRepository';
import { FirestoreTransactionRunner } from '../adapters/persistence/FirestoreTransactionRunner';
import { StorageSignedUrlAdapter } from '../adapters/storage/StorageSignedUrlAdapter';

const db = getFirestore();
export const connector = new FirestoreConnector(db);
export const transactionRunner = new FirestoreTransactionRunner(connector);
export const documentStoragePort = new StorageSignedUrlAdapter();

export const userRepository = new FirestoreUserRepository(connector);
export const reportRepository = new FirestoreReportRepository(connector);
export const fineRepository = new FirestoreFineRepository(connector);
export const carRepository = new FirestoreCarRepository(connector);

export * from './report/create-report';
export * from './fine/issue-fine';
export * from './fine/pay-fine';
export * from './user/set-user-role';
export * from './user/update-user-profile';
export * from './car/add-car';
export * from './car/check-plate';
export * from './car/approve-car';
export * from './car/reject-car';
export * from './car/approve-transfer';
export * from './car/retry-car';
export * from './car/request-car-deletion';
export * from './car/cancel-car-deletion';
export * from './car/request-ownership-transfer';
export * from './car/acknowledge-transfer';
export * from './car/reject-transfer';
export * from './car/approve-car-deletion';
export * from './car/get-document-url';
