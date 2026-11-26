import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { migrate as migrateV2 } from '../../migrations/v2__plate_as_id';
import { migrate as migrateV3 } from '../../migrations/v3__backfill_fines_and_audit_logs';
import { migrate as migrateV4 } from '../../migrations/v4__user_roles_array';
import { migrate as migrateV5 } from '../../migrations/v5__remove_legacy_user_role';
import { migrate as migrateV6 } from '../../migrations/v6__backfill_police_audit';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const app = getApps().length ? getApps()[0] : initializeApp({ projectId: 'parkalert-migration-test' });
const db = getFirestore(app);

async function clearCollection(name: string) {
  const snap = await db.collection(name).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

describe('US3: v2 and v3 Migrations', () => {
  beforeEach(async () => {
    await Promise.all([
      clearCollection('cars'),
      clearCollection('fines'),
      clearCollection('car_audit_logs'),
      clearCollection('migration_conflicts'),
      clearCollection('users'),
      clearCollection('reports'),
      clearCollection('enforcement_audit_logs'),
      clearCollection('police_audit_logs'),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      clearCollection('cars'),
      clearCollection('fines'),
      clearCollection('car_audit_logs'),
      clearCollection('migration_conflicts'),
      clearCollection('users'),
      clearCollection('reports'),
      clearCollection('enforcement_audit_logs'),
      clearCollection('police_audit_logs'),
    ]);
  });

  it('v2 migrates legacy IDs, updates car_audit_logs, and logs collisions without overwriting', async () => {
    await db.collection('cars').doc('legacy-1').set({
      id: 'legacy-1',
      ownerId: 'owner-a',
      plateNumber: 'AB-123-CD',
      status: 'active',
    });
    await db.collection('car_audit_logs').doc('log-1').set({
      carId: 'legacy-1',
      actorId: 'owner-a',
      action: 'APPROVED',
    });

    await db.collection('cars').doc('CD456EF').set({
      id: 'CD456EF',
      ownerId: 'owner-existing',
      plateNumber: 'CD-456-EF',
      plateNumberNormalized: 'CD456EF',
      status: 'active',
    });
    await db.collection('cars').doc('legacy-collision').set({
      id: 'legacy-collision',
      ownerId: 'owner-intruder',
      plateNumber: 'CD-456-EF',
      status: 'active',
    });

    await migrateV2({ firestore: db } as any);

    expect((await db.collection('cars').doc('AB123CD').get()).exists).toBe(true);
    expect((await db.collection('cars').doc('legacy-1').get()).exists).toBe(false);
    expect((await db.collection('car_audit_logs').doc('log-1').get()).data()?.carId).toBe('AB123CD');

    expect((await db.collection('cars').doc('CD456EF').get()).data()?.ownerId).toBe('owner-existing');
    const conflicts = await db.collection('migration_conflicts').get();
    expect(conflicts.size).toBe(1);
    expect(conflicts.docs[0].data().reason).toBe('CROSS_OWNER_DUPLICATE_PLATE');
  });

  it('v3 backfills fines.plateNumberNormalized idempotently', async () => {
    await db.collection('fines').doc('fine-legacy').set({
      ownerId: 'owner-a',
      plateNumber: 'EF-789-GH',
      status: 'unpaid',
      amount: 35,
    });

    await migrateV3({ firestore: db } as any);
    expect((await db.collection('fines').doc('fine-legacy').get()).data()?.plateNumberNormalized).toBe('EF789GH');

    // Re-running v3 is idempotent
    await migrateV3({ firestore: db } as any);
    expect((await db.collection('fines').doc('fine-legacy').get()).data()?.plateNumberNormalized).toBe('EF789GH');
  });

  it('v4 backfills roles array while retaining legacy role and skipping incomplete/already-migrated docs', async () => {
    await db.collection('users').doc('u-owner').set({ uid: 'u-owner', role: 'owner' });
    await db.collection('users').doc('u-police').set({ uid: 'u-police', role: 'police' });
    await db.collection('users').doc('u-agent').set({ uid: 'u-agent', role: 'agent' });
    await db.collection('users').doc('u-partial').set({ uid: 'u-partial', email: 'partial@test.com' });
    await db.collection('users').doc('u-existing').set({ uid: 'u-existing', role: 'owner', roles: ['owner'] });

    const first = await migrateV4({ firestore: db } as any);
    expect(first).toEqual({ migrated: 3, skipped: 2, errors: 0 });

    expect((await db.collection('users').doc('u-owner').get()).data()).toMatchObject({ role: 'owner', roles: ['owner'] });
    expect((await db.collection('users').doc('u-police').get()).data()).toMatchObject({ role: 'police', roles: ['police', 'owner'] });
    expect((await db.collection('users').doc('u-agent').get()).data()).toMatchObject({ role: 'agent', roles: ['agent', 'owner'] });
    expect((await db.collection('users').doc('u-partial').get()).data()?.roles).toBeUndefined();

    // Idempotent re-run
    const second = await migrateV4({ firestore: db } as any);
    expect(second).toEqual({ migrated: 0, skipped: 5, errors: 0 });
  });

  it('v5 backfills remaining unmigrated docs and deletes legacy role idempotently', async () => {
    await db.collection('users').doc('u-unmigrated').set({ uid: 'u-unmigrated', role: 'police' });
    await db.collection('users').doc('u-migrated').set({ uid: 'u-migrated', role: 'agent', roles: ['agent', 'owner'] });
    await db.collection('users').doc('u-clean').set({ uid: 'u-clean', roles: ['owner'] });

    const first = await migrateV5({ firestore: db } as any);
    expect(first).toEqual({ backfilled: 1, cleaned: 2, skipped: 1, errors: 0 });

    const unmigrated = (await db.collection('users').doc('u-unmigrated').get()).data()!;
    expect(unmigrated.roles).toEqual(['police', 'owner']);
    expect('role' in unmigrated).toBe(false);

    const migrated = (await db.collection('users').doc('u-migrated').get()).data()!;
    expect(migrated.roles).toEqual(['agent', 'owner']);
    expect('role' in migrated).toBe(false);

    // Idempotent re-run
    const second = await migrateV5({ firestore: db } as any);
    expect(second).toEqual({ backfilled: 0, cleaned: 0, skipped: 3, errors: 0 });
  });

  it('v6 backfills police_audit_logs from enforcement_audit_logs and car_audit_logs idempotently', async () => {
    const now = new Date('2026-11-25T12:00:00Z');
    await db.collection('users').doc('pol-1').set({ uid: 'pol-1', roles: ['police', 'owner'] });
    await db.collection('cars').doc('AB123CD').set({
      id: 'AB123CD',
      ownerId: 'owner-a',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      status: 'active',
    });
    await db.collection('fines').doc('fine-1').set({
      ownerId: 'owner-a',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      status: 'unpaid',
      amount: 50,
    });
    await db.collection('enforcement_audit_logs').doc('enf-1').set({
      targetType: 'fine',
      targetId: 'fine-1',
      actorId: 'pol-1',
      action: 'ISSUE_FINE',
      issuedPlate: 'AB-123-CD',
      timestamp: now,
    });
    await db.collection('car_audit_logs').doc('car-1').set({
      carId: 'AB123CD',
      actorId: 'pol-1',
      action: 'APPROVED',
      timestamp: now,
    });

    const first = await migrateV6({ firestore: db } as any);
    expect(first).toEqual({ created: 2, skipped: 0, errors: 0 });
    const enfAuditSnap = await db.collection('police_audit_logs').doc('v6_enf_enf-1').get();
    expect(enfAuditSnap.data()).toMatchObject({
      targetType: 'fine',
      targetId: 'fine-1',
      ownerId: 'owner-a',
      plateNumberNormalized: 'AB123CD',
      action: 'ISSUE_FINE',
      reason: null,
    });
    const carAuditSnap = await db.collection('police_audit_logs').doc('v6_car_car-1').get();
    expect(carAuditSnap.data()).toMatchObject({
      targetType: 'car',
      targetId: 'AB123CD',
      ownerId: 'owner-a',
      plateNumberNormalized: 'AB123CD',
      action: 'CAR_APPROVED',
      reason: null,
    });

    const second = await migrateV6({ firestore: db } as any);
    expect(second).toEqual({ created: 0, skipped: 2, errors: 0 });
  });
});
