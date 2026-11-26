import {
  DocumentReference,
  FieldPath as AdminFieldPath,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { MigrateOptions } from 'fireway';

const MAX_BATCH_OPS = 450;

const CAR_ACTION_MAP: Record<string, string> = {
  APPROVED: 'CAR_APPROVED',
  REJECTED: 'CAR_REJECTED',
  DELETION_APPROVED: 'CAR_DELETION_APPROVED',
  TRANSFER_APPROVED: 'TRANSFER_APPROVED',
  TRANSFER_REJECTED: 'TRANSFER_REJECTED',
};

const ENFORCEMENT_ACTIONS = new Set([
  'DISMISS_REPORT',
  'ISSUE_FINE',
  'CANCEL_FINE',
  'DISMISS_DISPUTE',
]);

function normalizePlate(plateNumber: unknown): string {
  return String(plateNumber ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function resolveCarOwnerFromDocs(cars: Array<Record<string, any>>): string {
  const eligible = cars.filter(
    (car) => car.status !== 'archived' && car.status !== 'rejected'
  );
  const chosen = eligible.find((car) => car.status === 'active') ?? eligible[0];
  return typeof chosen?.ownerId === 'string' ? chosen.ownerId : '';
}

function userHasPoliceRole(userData: Record<string, any> | null): boolean {
  if (!userData) return false;
  if (Array.isArray(userData.roles)) {
    return userData.roles.includes('police');
  }
  return userData.role === 'police';
}

function isOwnerStageTransferRejection(
  logData: Record<string, any>,
  carData: Record<string, any> | null,
  actorData: Record<string, any> | null
): boolean {
  if (typeof logData.details === 'string' && logData.details.toLowerCase().includes('owner')) {
    return true;
  }
  if (!userHasPoliceRole(actorData)) {
    return true;
  }
  const actorId = typeof logData.actorId === 'string' ? logData.actorId : '';
  if (!actorId || !carData) {
    return false;
  }
  if (carData.ownerId === actorId) {
    return true;
  }
  if (Array.isArray(carData.ownershipHistory) && carData.ownershipHistory.includes(actorId)) {
    return true;
  }
  return false;
}

async function fetchExistingDocIds(
  firestore: MigrateOptions['firestore'],
  refs: DocumentReference[]
): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const snaps =
    typeof (firestore as any).getAll === 'function'
      ? await (firestore as any).getAll(...refs)
      : await Promise.all(refs.map((ref) => ref.get()));
  const existing = new Set<string>();
  for (const snap of snaps) {
    if (snap?.exists) {
      existing.add(snap.id);
    }
  }
  return existing;
}

/**
 * Migration v6: Backfills unified `police_audit_logs` documents idempotently from
 * historical `enforcement_audit_logs` and `car_audit_logs` records using deterministic doc IDs.
 */
export async function migrate({ firestore, FieldPath }: MigrateOptions) {
  console.log('Starting migration v6 (backfill police_audit_logs)...');

  const resolvedFieldPath = FieldPath ?? AdminFieldPath;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  const docCache = new Map<string, Record<string, any> | null>();
  const plateCarsCache = new Map<string, Array<Record<string, any>>>();

  async function getCachedDoc(collectionName: string, docId: string): Promise<Record<string, any> | null> {
    if (!docId) return null;
    const key = `${collectionName}/${docId}`;
    if (docCache.has(key)) {
      return docCache.get(key) ?? null;
    }
    const snap = await firestore.collection(collectionName).doc(docId).get();
    const data = snap.exists ? (snap.data() as Record<string, any>) : null;
    docCache.set(key, data);
    return data;
  }

  async function getCarsByNormalizedPlate(normalizedPlate: string): Promise<Array<Record<string, any>>> {
    if (!normalizedPlate) return [];
    if (plateCarsCache.has(normalizedPlate)) {
      return plateCarsCache.get(normalizedPlate) ?? [];
    }
    const snap = await firestore
      .collection('cars')
      .where('plateNumberNormalized', '==', normalizedPlate)
      .get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
    plateCarsCache.set(normalizedPlate, docs);
    return docs;
  }

  async function commitChunk(
    pending: Array<{ docId: string; payload: Record<string, unknown> }>
  ): Promise<void> {
    if (pending.length === 0) return;

    for (let i = 0; i < pending.length; i += MAX_BATCH_OPS) {
      const slice = pending.slice(i, i + MAX_BATCH_OPS);
      const refs = slice.map((item) => firestore.collection('police_audit_logs').doc(item.docId));
      const existingIds = await fetchExistingDocIds(firestore, refs);

      const batch = firestore.batch();
      let ops = 0;
      for (let j = 0; j < slice.length; j++) {
        const item = slice[j]!;
        const ref = refs[j]!;
        if (existingIds.has(item.docId)) {
          skipped++;
          continue;
        }
        batch.set(ref, item.payload);
        ops++;
        created++;
      }

      if (ops > 0) {
        await batch.commit();
      }
    }
  }

  // 1. Backfill from enforcement_audit_logs
  let lastEnfDoc: QueryDocumentSnapshot | undefined;
  while (true) {
    let pageQuery = firestore
      .collection('enforcement_audit_logs')
      .orderBy(resolvedFieldPath.documentId())
      .limit(MAX_BATCH_OPS);
    if (lastEnfDoc) {
      pageQuery = pageQuery.startAfter(lastEnfDoc);
    }

    const snap = await pageQuery.get();
    if (snap.empty) break;

    const pending: Array<{ docId: string; payload: Record<string, unknown> }> = [];

    for (const logDoc of snap.docs) {
      try {
        const data = logDoc.data() || {};
        const action = typeof data.action === 'string' ? data.action : '';
        if (!ENFORCEMENT_ACTIONS.has(action)) {
          skipped++;
          continue;
        }

        const targetId = typeof data.targetId === 'string' ? data.targetId : '';
        const actorId = typeof data.actorId === 'string' ? data.actorId : '';
        const reason =
          typeof data.reason === 'string' && data.reason.trim() ? data.reason.trim() : null;
        const timestamp = data.timestamp ?? new Date(0);

        if (action === 'DISMISS_REPORT') {
          const report = await getCachedDoc('reports', targetId);
          const plateNumber = typeof report?.plateNumber === 'string' ? report.plateNumber : '';
          const plateNumberNormalized = normalizePlate(plateNumber);
          const matchingCars = await getCarsByNormalizedPlate(plateNumberNormalized);
          const ownerId = resolveCarOwnerFromDocs(matchingCars);

          pending.push({
            docId: `v6_enf_${logDoc.id}`,
            payload: {
              targetType: 'report',
              targetId,
              actorId,
              ownerId,
              plateNumber,
              plateNumberNormalized,
              action,
              reason,
              timestamp,
            },
          });
        } else {
          const fine = await getCachedDoc('fines', targetId);
          const plateNumber =
            (typeof fine?.plateNumber === 'string' && fine.plateNumber) ||
            (typeof data.issuedPlate === 'string' && data.issuedPlate) ||
            '';
          const plateNumberNormalized =
            (typeof fine?.plateNumberNormalized === 'string' && fine.plateNumberNormalized) ||
            normalizePlate(plateNumber);
          const ownerId = typeof fine?.ownerId === 'string' ? fine.ownerId : '';
          const originalPlateNumber =
            (typeof data.originalPlate === 'string' && data.originalPlate) ||
            (typeof fine?.originalPlateNumber === 'string' && fine.originalPlateNumber) ||
            undefined;

          const payload: Record<string, unknown> = {
            targetType: 'fine',
            targetId,
            actorId,
            ownerId,
            plateNumber,
            plateNumberNormalized,
            action,
            reason,
            timestamp,
          };
          if (originalPlateNumber) {
            payload.metadata = { originalPlateNumber };
          }

          pending.push({
            docId: `v6_enf_${logDoc.id}`,
            payload,
          });
        }
      } catch (err) {
        errors++;
        console.error(`Failed processing enforcement_audit_logs/${logDoc.id} in v6:`, err);
      }
    }

    await commitChunk(pending);

    lastEnfDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < MAX_BATCH_OPS) break;
  }

  // 2. Backfill from car_audit_logs
  let lastCarLogDoc: QueryDocumentSnapshot | undefined;
  while (true) {
    let pageQuery = firestore
      .collection('car_audit_logs')
      .orderBy(resolvedFieldPath.documentId())
      .limit(MAX_BATCH_OPS);
    if (lastCarLogDoc) {
      pageQuery = pageQuery.startAfter(lastCarLogDoc);
    }

    const snap = await pageQuery.get();
    if (snap.empty) break;

    const pending: Array<{ docId: string; payload: Record<string, unknown> }> = [];

    for (const logDoc of snap.docs) {
      try {
        const data = logDoc.data() || {};
        const rawAction = typeof data.action === 'string' ? data.action : '';
        const mappedAction = CAR_ACTION_MAP[rawAction];
        if (!mappedAction) {
          skipped++;
          continue;
        }

        const carId = typeof data.carId === 'string' ? data.carId : '';
        const actorId = typeof data.actorId === 'string' ? data.actorId : '';
        const car = await getCachedDoc('cars', carId);

        if (mappedAction === 'TRANSFER_REJECTED') {
          const actor = await getCachedDoc('users', actorId);
          if (isOwnerStageTransferRejection(data, car, actor)) {
            skipped++;
            continue;
          }
        }

        const plateNumber =
          (typeof car?.plateNumber === 'string' && car.plateNumber) || carId;
        const plateNumberNormalized =
          (typeof car?.plateNumberNormalized === 'string' && car.plateNumberNormalized) ||
          normalizePlate(plateNumber);
        const ownerId = typeof car?.ownerId === 'string' ? car.ownerId : '';
        const reason =
          typeof data.reason === 'string' && data.reason.trim() ? data.reason.trim() : null;
        const timestamp = data.timestamp ?? new Date(0);

        pending.push({
          docId: `v6_car_${logDoc.id}`,
          payload: {
            targetType: 'car',
            targetId: carId,
            actorId,
            ownerId,
            plateNumber,
            plateNumberNormalized,
            action: mappedAction,
            reason,
            timestamp,
          },
        });
      } catch (err) {
        errors++;
        console.error(`Failed processing car_audit_logs/${logDoc.id} in v6:`, err);
      }
    }

    await commitChunk(pending);

    lastCarLogDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < MAX_BATCH_OPS) break;
  }

  console.log('Migration v6 finished.', { created, skipped, errors });
  return { created, skipped, errors };
}
