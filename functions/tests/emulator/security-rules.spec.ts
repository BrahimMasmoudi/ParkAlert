import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getBytes, ref as storageRef, uploadString } from 'firebase/storage';

let testEnv: RulesTestEnvironment;

describe('US2: Firestore & Storage Security Rules', () => {
  beforeAll(async () => {
    const rootDir = path.resolve(__dirname, '../../..');
    testEnv = await initializeTestEnvironment({
      projectId: 'parkalert-rules-test',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8'),
      },
      storage: {
        host: '127.0.0.1',
        port: 9199,
        rules: fs.readFileSync(path.join(rootDir, 'storage.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/owner-a'), { uid: 'owner-a', roles: ['owner'] });
      await setDoc(doc(db, 'users/owner-b'), { uid: 'owner-b', roles: ['owner'] });
      await setDoc(doc(db, 'users/police-1'), { uid: 'police-1', roles: ['police', 'owner'] });

      await setDoc(doc(db, 'cars/AB123CD'), {
        id: 'AB123CD',
        ownerId: 'owner-b',
        ownershipHistory: ['owner-a'],
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        status: 'active',
        carteGriseUrl: 'transfers/owner-b/doc.pdf',
      });

      await setDoc(doc(db, 'fines/fine-1'), {
        ownerId: 'owner-a',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        amount: 35,
        status: 'paid',
      });

      const storage = ctx.storage();
      await uploadString(storageRef(storage, 'transfers/owner-b/doc.pdf'), 'secret-pdf', 'raw', {
        contentType: 'application/pdf',
      });
    });
  });

  it('denies Owner A read access to transferred vehicle even with ownershipHistory, while preserving fine history', async () => {
    const ownerADb = testEnv.authenticatedContext('owner-a').firestore();
    const ownerBDb = testEnv.authenticatedContext('owner-b').firestore();
    const policeDb = testEnv.authenticatedContext('police-1').firestore();

    await assertFails(getDoc(doc(ownerADb, 'cars/AB123CD')));
    await assertFails(
      getDocs(query(collection(ownerADb, 'cars'), where('ownershipHistory', 'array-contains', 'owner-a')))
    );
    await assertSucceeds(getDoc(doc(ownerADb, 'fines/fine-1')));

    await assertSucceeds(getDoc(doc(ownerBDb, 'cars/AB123CD')));
    await assertSucceeds(getDoc(doc(policeDb, 'cars/AB123CD')));
    await assertFails(setDoc(doc(ownerBDb, 'cars/AB123CD'), { status: 'active' }));
  });

  it('denies all direct Storage reads on /transfers and /carteGrise while enforcing uploader-only writes', async () => {
    const ownerAStorage = testEnv.authenticatedContext('owner-a').storage();
    const ownerBStorage = testEnv.authenticatedContext('owner-b').storage();
    const policeStorage = testEnv.authenticatedContext('police-1').storage();

    await assertFails(getBytes(storageRef(ownerAStorage, 'transfers/owner-b/doc.pdf')));
    await assertFails(getBytes(storageRef(ownerBStorage, 'transfers/owner-b/doc.pdf')));
    await assertFails(getBytes(storageRef(policeStorage, 'transfers/owner-b/doc.pdf')));

    await assertFails(
      uploadString(storageRef(ownerAStorage, 'transfers/owner-b/evil.pdf'), 'x', 'raw', {
        contentType: 'application/pdf',
      })
    );
    await assertSucceeds(
      uploadString(storageRef(ownerBStorage, 'transfers/owner-b/ok.pdf'), 'ok', 'raw', {
        contentType: 'application/pdf',
      })
    );
  });
});
