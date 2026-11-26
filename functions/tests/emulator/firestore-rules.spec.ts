import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe('Release 2 Firestore Rules: /reports, /fines, and /enforcement_audit_logs', () => {
  beforeAll(async () => {
    const rootDir = path.resolve(__dirname, '../../..');
    testEnv = await initializeTestEnvironment({
      projectId: 'parkalert-rules-test',
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/owner-1'), { uid: 'owner-1', roles: ['owner'] });
      await setDoc(doc(db, 'users/owner-2'), { uid: 'owner-2', roles: ['owner'] });
      await setDoc(doc(db, 'users/agent-1'), { uid: 'agent-1', roles: ['agent', 'owner'] });
      await setDoc(doc(db, 'users/police-1'), { uid: 'police-1', roles: ['police', 'owner'] });
      await setDoc(doc(db, 'users/police-only'), { uid: 'police-only', roles: ['police'] });
      await setDoc(doc(db, 'users/legacy-police'), { uid: 'legacy-police', role: 'police' });

      await setDoc(doc(db, 'reports/rep-1'), {
        agentId: 'agent-1',
        plateNumber: 'AB-123-CD',
        status: 'pending',
      });
      await setDoc(doc(db, 'fines/fine-1'), {
        ownerId: 'owner-1',
        reportId: 'rep-1',
        status: 'unpaid',
        disputeStatus: 'pending',
        disputedAt: new Date(),
      });
      await setDoc(doc(db, 'enforcement_audit_logs/log-1'), {
        targetType: 'fine',
        targetId: 'fine-1',
        action: 'DISPUTE_FINE',
      });
      await setDoc(doc(db, 'police_audit_logs/pa-1'), {
        targetType: 'fine',
        targetId: 'fine-1',
        actorId: 'police-1',
        ownerId: 'owner-1',
        plateNumber: 'AB-123-CD',
        plateNumberNormalized: 'AB123CD',
        action: 'ISSUE_FINE',
        reason: null,
        timestamp: new Date(),
      });
    });
  });

  it('blocks owners from /reports, restricts /fines reads to police or own ownerId, supports police pendingDisputesQuery, and denies client /enforcement_audit_logs access', async () => {
    const owner1Db = testEnv.authenticatedContext('owner-1').firestore();
    const owner2Db = testEnv.authenticatedContext('owner-2').firestore();
    const agentDb = testEnv.authenticatedContext('agent-1').firestore();
    const policeDb = testEnv.authenticatedContext('police-1').firestore();

    await assertFails(getDoc(doc(owner1Db, 'reports/rep-1')));
    await assertSucceeds(getDoc(doc(agentDb, 'reports/rep-1')));
    await assertSucceeds(getDoc(doc(policeDb, 'reports/rep-1')));

    await assertSucceeds(getDoc(doc(owner1Db, 'fines/fine-1')));
    await assertFails(getDoc(doc(owner2Db, 'fines/fine-1')));
    await assertFails(getDoc(doc(agentDb, 'fines/fine-1')));

    const disputesSnap = await assertSucceeds(
      getDocs(
        query(
          collection(policeDb, 'fines'),
          where('disputeStatus', '==', 'pending'),
          orderBy('disputedAt', 'asc'),
          limit(250)
        )
      )
    );
    expect(disputesSnap.size).toBe(1);

    await assertFails(getDoc(doc(policeDb, 'enforcement_audit_logs/log-1')));
    await assertFails(getDoc(doc(owner1Db, 'enforcement_audit_logs/log-1')));
    await assertFails(
      setDoc(doc(policeDb, 'enforcement_audit_logs/log-2'), { action: 'CANCEL_FINE' })
    );

    const legacyPoliceDb = testEnv.authenticatedContext('legacy-police').firestore();
    await assertFails(getDoc(doc(legacyPoliceDb, 'reports/rep-1')));
    await assertFails(
      setDoc(doc(owner1Db, 'users/owner-1'), { uid: 'owner-1', roles: ['police', 'owner'] })
    );
  });

  it('restricts /fines/{fineId}/receipt/summary reads to the owning user, allows missing receipt checks, blocks police-only users, and denies client writes', async () => {
    const owner1Db = testEnv.authenticatedContext('owner-1').firestore();
    const owner2Db = testEnv.authenticatedContext('owner-2').firestore();
    const policeOnlyDb = testEnv.authenticatedContext('police-only').firestore();

    // Missing receipt summary on unpaid/legacy fine resolves as non-existent rather than PERMISSION_DENIED
    const missingSnap = await assertSucceeds(getDoc(doc(owner1Db, 'fines/fine-1/receipt/summary')));
    expect(missingSnap.exists()).toBe(false);

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'fines/fine-1/receipt/summary'), {
        cardholderName: 'Amira Ben Salah',
        cardBrand: 'visa',
        cardLast4: '4242',
      });
    });

    const presentSnap = await assertSucceeds(getDoc(doc(owner1Db, 'fines/fine-1/receipt/summary')));
    expect(presentSnap.exists()).toBe(true);
    expect(presentSnap.data()).toEqual({
      cardholderName: 'Amira Ben Salah',
      cardBrand: 'visa',
      cardLast4: '4242',
    });

    // Other owners, dual-role police users reading another owner's receipt, and police-only users cannot read receipt/summary
    const police1Db = testEnv.authenticatedContext('police-1').firestore();
    await assertFails(getDoc(doc(owner2Db, 'fines/fine-1/receipt/summary')));
    await assertSucceeds(getDoc(doc(policeOnlyDb, 'fines/fine-1')));
    await assertFails(getDoc(doc(policeOnlyDb, 'fines/fine-1/receipt/summary')));
    await assertSucceeds(getDoc(doc(police1Db, 'fines/fine-1')));
    await assertFails(getDoc(doc(police1Db, 'fines/fine-1/receipt/summary')));

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'fines/fine-pol-own'), {
        ownerId: 'police-1',
        reportId: 'rep-1',
        status: 'paid',
      });
      await setDoc(doc(db, 'fines/fine-pol-own/receipt/summary'), {
        cardholderName: 'Officer Self',
        cardBrand: 'mastercard',
        cardLast4: '8888',
      });
    });
    await assertSucceeds(getDoc(doc(police1Db, 'fines/fine-pol-own/receipt/summary')));

    // Client writes are denied
    await assertFails(
      setDoc(doc(owner1Db, 'fines/fine-1/receipt/summary'), {
        cardholderName: 'Tamper',
        cardBrand: 'visa',
        cardLast4: '1111',
      })
    );
    await assertFails(
      updateDoc(doc(owner1Db, 'fines/fine-1/receipt/summary'), { cardLast4: '9999' })
    );
    await assertFails(deleteDoc(doc(owner1Db, 'fines/fine-1/receipt/summary')));
    await assertFails(
      setDoc(doc(policeOnlyDb, 'fines/fine-1/receipt/summary'), {
        cardholderName: 'Tamper',
        cardBrand: 'visa',
        cardLast4: '1111',
      })
    );
  });

  it('allows police role reads on /police_audit_logs, blocks owners/agents/legacy/unauthenticated reads, and denies all client writes', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const owner1Db = testEnv.authenticatedContext('owner-1').firestore();
    const agentDb = testEnv.authenticatedContext('agent-1').firestore();
    const legacyPoliceDb = testEnv.authenticatedContext('legacy-police').firestore();
    const police1Db = testEnv.authenticatedContext('police-1').firestore();
    const policeOnlyDb = testEnv.authenticatedContext('police-only').firestore();

    const policeSnap = await assertSucceeds(getDoc(doc(police1Db, 'police_audit_logs/pa-1')));
    expect(policeSnap.exists()).toBe(true);
    await assertSucceeds(getDoc(doc(policeOnlyDb, 'police_audit_logs/pa-1')));

    const listSnap = await assertSucceeds(
      getDocs(query(collection(police1Db, 'police_audit_logs'), orderBy('timestamp', 'desc'), limit(25)))
    );
    expect(listSnap.size).toBe(1);

    await assertFails(getDoc(doc(anonDb, 'police_audit_logs/pa-1')));
    await assertFails(getDoc(doc(owner1Db, 'police_audit_logs/pa-1')));
    await assertFails(getDoc(doc(agentDb, 'police_audit_logs/pa-1')));
    await assertFails(getDoc(doc(legacyPoliceDb, 'police_audit_logs/pa-1')));

    await assertFails(
      setDoc(doc(police1Db, 'police_audit_logs/pa-2'), { action: 'ISSUE_FINE' })
    );
    await assertFails(
      updateDoc(doc(police1Db, 'police_audit_logs/pa-1'), { reason: 'Tamper' })
    );
    await assertFails(deleteDoc(doc(police1Db, 'police_audit_logs/pa-1')));
  });
});
