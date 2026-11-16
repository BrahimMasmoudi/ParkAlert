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
  const snapshot = await firestore.collection('cars').get();
  console.log(`Starting migration v2 for ${snapshot.size} cars...`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const plateNumber = data.plateNumber;

    if (!plateNumber) {
      console.warn(`Car ${doc.id} has no plateNumber, skipping.`);
      continue;
    }

    const normalized = normalizePlate(plateNumber);
    if (!normalized) {
      console.warn(`Car ${doc.id} normalized plate is empty, skipping.`);
      continue;
    }

    const newData = {
      ...data,
      plateNumberNormalized: normalized,
      id: normalized,
    };

    if (doc.id !== normalized) {
      const newDocRef = firestore.collection('cars').doc(normalized);
      let collided = false;

      await firestore.runTransaction(async (tx) => {
        const freshSource = await tx.get(doc.ref);
        if (!freshSource.exists) return;

        const targetDoc = await tx.get(newDocRef);
        if (targetDoc.exists) {
          collided = true;
          const targetData = targetDoc.data() || {};
          const conflictRef = firestore.collection('migration_conflicts').doc();
          tx.set(conflictRef, {
            migration: 'v2__plate_as_id',
            sourceCarId: doc.id,
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

        tx.set(newDocRef, newData);
        tx.delete(doc.ref);
      });

      if (!collided) {
        await updateAuditLogsCarId(firestore, doc.id, normalized);
      }
    } else if (!data.plateNumberNormalized) {
      await doc.ref.update({ plateNumberNormalized: normalized });
    }
  }

  console.log('Migration v2 finished.');
}
