import { MigrateOptions } from 'fireway';

const MAX_BATCH_OPS = 450;

function normalizePlate(plateNumber: unknown): string {
  return String(plateNumber ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function updateAuditLogsCarId(
  firestore: MigrateOptions['firestore'],
  oldCarId: string,
  newCarId: string
): Promise<void> {
  const logsSnap = await firestore
    .collection('car_audit_logs')
    .where('carId', '==', oldCarId)
    .get();

  if (logsSnap.empty) return;

  for (let i = 0; i < logsSnap.docs.length; i += MAX_BATCH_OPS) {
    const batch = firestore.batch();
    const chunk = logsSnap.docs.slice(i, i + MAX_BATCH_OPS);
    for (const logDoc of chunk) {
      batch.update(logDoc.ref, { carId: newCarId });
    }
    await batch.commit();
  }
}

export async function migrate({ firestore }: MigrateOptions) {
  console.log('Starting migration v3 (fines plateNumberNormalized backfill & car/audit repair)...');

  // 1. Backfill plateNumberNormalized on existing fines in <=450 chunks
  const finesSnap = await firestore.collection('fines').get();
  const finesToUpdate = finesSnap.docs.filter((doc) => {
    const data = doc.data();
    const normalized = normalizePlate(data.plateNumber);
    return normalized && data.plateNumberNormalized !== normalized;
  });

  for (let i = 0; i < finesToUpdate.length; i += MAX_BATCH_OPS) {
    const batch = firestore.batch();
    const chunk = finesToUpdate.slice(i, i + MAX_BATCH_OPS);
    for (const fineDoc of chunk) {
      const data = fineDoc.data();
      batch.update(fineDoc.ref, {
        plateNumberNormalized: normalizePlate(data.plateNumber),
      });
    }
    await batch.commit();
  }
  console.log(`Backfilled plateNumberNormalized on ${finesToUpdate.length} fines.`);

  // 2. Safely repair any remaining legacy car IDs without overwriting colliding plates
  const carsSnap = await firestore.collection('cars').get();
  for (const carDoc of carsSnap.docs) {
    const data = carDoc.data();
    const normalized = normalizePlate(data.plateNumber);
    if (!normalized) continue;

    if (carDoc.id !== normalized) {
      const targetRef = firestore.collection('cars').doc(normalized);
      let collided = false;

      await firestore.runTransaction(async (tx) => {
        const source = await tx.get(carDoc.ref);
        if (!source.exists) return;

        const target = await tx.get(targetRef);
        if (target.exists) {
          collided = true;
          const targetData = target.data() || {};
          const conflictRef = firestore.collection('migration_conflicts').doc();
          tx.set(conflictRef, {
            migration: 'v3__backfill_fines_and_audit_logs',
            sourceCarId: carDoc.id,
            targetCarId: normalized,
            sourceOwnerId: data.ownerId ?? null,
            targetOwnerId: targetData.ownerId ?? null,
            reason:
              data.ownerId === targetData.ownerId
                ? 'SAME_OWNER_DUPLICATE_PLATE'
                : 'CROSS_OWNER_DUPLICATE_PLATE',
            createdAt: new Date(),
          });
          return;
        }

        tx.set(targetRef, {
          ...data,
          id: normalized,
          plateNumberNormalized: normalized,
        });
        tx.delete(carDoc.ref);
      });

      if (!collided) {
        await updateAuditLogsCarId(firestore, carDoc.id, normalized);
      }
    } else if (data.plateNumberNormalized !== normalized || data.id !== normalized) {
      await carDoc.ref.update({
        id: normalized,
        plateNumberNormalized: normalized,
      });
    }
  }

  console.log('Migration v3 finished.');
}
