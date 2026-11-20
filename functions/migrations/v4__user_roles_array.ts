import { FieldPath as AdminFieldPath, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { MigrateOptions } from 'fireway';

const MAX_BATCH_OPS = 450;

const LEGACY_ROLE_MAP: Record<string, string[]> = {
  owner: ['owner'],
  police: ['police', 'owner'],
  agent: ['agent', 'owner'],
};

/**
 * Migration v4: Backfills `users/{uid}.roles` from legacy singular `role` while retaining `role`
 * for dual-read compatibility during rollout.
 */
export async function migrate({ firestore, FieldPath }: MigrateOptions) {
  console.log('Starting migration v4 (additive users.roles array backfill)...');

  const resolvedFieldPath = FieldPath ?? AdminFieldPath;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let pageQuery = firestore
      .collection('users')
      .orderBy(resolvedFieldPath.documentId())
      .limit(MAX_BATCH_OPS);

    if (lastDoc) {
      pageQuery = pageQuery.startAfter(lastDoc);
    }

    const snap = await pageQuery.get();
    if (snap.empty) {
      break;
    }

    const batch = firestore.batch();
    let ops = 0;

    for (const userDoc of snap.docs) {
      try {
        const data = userDoc.data() || {};
        const hasRoles = Array.isArray(data.roles) && data.roles.length > 0;
        const mappedRoles =
          typeof data.role === 'string' ? LEGACY_ROLE_MAP[data.role] : undefined;

        if (hasRoles || !mappedRoles) {
          skipped++;
          continue;
        }

        batch.update(userDoc.ref, { roles: mappedRoles });
        ops++;
        migrated++;
      } catch (err) {
        errors++;
        console.error(`Failed processing user ${userDoc.id} in v4:`, err);
      }
    }

    if (ops > 0) {
      await batch.commit();
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < MAX_BATCH_OPS) {
      break;
    }
  }

  console.log('Migration v4 finished.', { migrated, skipped, errors });
  return { migrated, skipped, errors };
}
