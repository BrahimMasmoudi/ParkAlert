import {
  FieldPath as AdminFieldPath,
  FieldValue as AdminFieldValue,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { MigrateOptions } from 'fireway';

const MAX_BATCH_OPS = 450;

const LEGACY_ROLE_MAP: Record<string, string[]> = {
  owner: ['owner'],
  police: ['police', 'owner'],
  agent: ['agent', 'owner'],
};

/**
 * Migration v5: Backfills `roles` for any remaining unmigrated user doc holding a valid legacy
 * `role` and deletes the legacy `role` field.
 */
export async function migrate({ firestore, FieldPath, FieldValue }: MigrateOptions) {
  console.log('Starting migration v5 (unmigrated backfill & remove legacy users.role)...');

  const resolvedFieldPath = FieldPath ?? AdminFieldPath;
  const resolvedFieldValue = FieldValue ?? AdminFieldValue;
  let backfilled = 0;
  let cleaned = 0;
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
        const hasLegacyRoleField = Object.prototype.hasOwnProperty.call(data, 'role');

        const needsBackfill = !hasRoles && Boolean(mappedRoles);
        if (!needsBackfill && !hasLegacyRoleField) {
          skipped++;
          continue;
        }

        const updates: Record<string, unknown> = {};
        if (needsBackfill && mappedRoles) {
          updates.roles = mappedRoles;
          backfilled++;
        }
        if (hasLegacyRoleField) {
          updates.role = resolvedFieldValue.delete();
          cleaned++;
        }

        batch.update(userDoc.ref, updates);
        ops++;
      } catch (err) {
        errors++;
        console.error(`Failed processing user ${userDoc.id} in v5:`, err);
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

  console.log('Migration v5 finished.', { backfilled, cleaned, skipped, errors });
  return { backfilled, cleaned, skipped, errors };
}
