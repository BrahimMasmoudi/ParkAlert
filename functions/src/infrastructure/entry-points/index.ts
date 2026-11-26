import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreConnector } from '../connectors/FirestoreConnector';
import { FirestoreReportRepository } from '../adapters/persistence/FirestoreReportRepository';
import { FirestoreUserRepository } from '../adapters/persistence/FirestoreUserRepository';
import { FirestoreFineRepository } from '../adapters/persistence/FirestoreFineRepository';
import { FirestoreCarRepository } from '../adapters/persistence/FirestoreCarRepository';
import { FirestoreTransactionRunner } from '../adapters/persistence/FirestoreTransactionRunner';
import { EnforcementAuditHelper } from '../adapters/persistence/EnforcementAuditHelper';
import { PoliceAuditHelper } from '../adapters/persistence/PoliceAuditHelper';
import { StorageSignedUrlAdapter } from '../adapters/storage/StorageSignedUrlAdapter';

const db = getFirestore();
export const connector = new FirestoreConnector(db);
export const transactionRunner = new FirestoreTransactionRunner(connector);
export const documentStoragePort = new StorageSignedUrlAdapter();
export const enforcementAuditPort = new EnforcementAuditHelper(connector);
export const policeAuditPort = new PoliceAuditHelper(connector);

export const userRepository = new FirestoreUserRepository(connector);
export const reportRepository = new FirestoreReportRepository(connector);
export const fineRepository = new FirestoreFineRepository(connector);
export const carRepository = new FirestoreCarRepository(connector);

export * from './endpoints';
