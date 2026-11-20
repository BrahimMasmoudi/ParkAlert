import { describe, expect, it, vi } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import { migrate as migrateV4 } from '../../migrations/v4__user_roles_array';
import { migrate as migrateV5 } from '../../migrations/v5__remove_legacy_user_role';

function createMockFirestore(docsSeed: Array<{ id: string; data: Record<string, any> }>) {
  const store = new Map(docsSeed.map((d) => [d.id, { ...d.data }]));
  const updates: Array<{ id: string; payload: Record<string, any> }> = [];

  const firestore = {
    collection: vi.fn(() => {
      const chain: any = {
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        startAfter: vi.fn(() => chain),
        get: vi.fn(async () => {
          const docs = Array.from(store.entries()).map(([id, data]) => ({
            id,
            ref: { id },
            data: () => ({ ...data }),
          }));
          return {
            empty: docs.length === 0,
            size: docs.length,
            docs,
          };
        }),
      };
      return chain;
    }),
    batch: vi.fn(() => {
      const pendingOps: Array<{ id: string; payload: Record<string, any> }> = [];
      return {
        update: vi.fn((ref: { id: string }, payload: Record<string, any>) => {
          pendingOps.push({ id: ref.id, payload });
        }),
        commit: vi.fn(async () => {
          for (const op of pendingOps) {
            updates.push(op);
            const cur = { ...(store.get(op.id) ?? {}) };
            for (const [k, v] of Object.entries(op.payload)) {
              if (
                v === FieldValue.delete() ||
                v === '__CUSTOM_DELETE__' ||
                (v && typeof v === 'object' && v.constructor?.name === 'DeleteTransform')
              ) {
                delete cur[k];
              } else {
                cur[k] = v;
              }
            }
            store.set(op.id, cur);
          }
        }),
      };
    }),
  };

  return { firestore: firestore as any, store, updates };
}

describe('v4 & v5 user roles migrations (unit)', () => {
  it('v4 backfills owner, police, and agent roles while skipping partial and already-migrated users', async () => {
    const { firestore, store } = createMockFirestore([
      { id: 'u1', data: { uid: 'u1', role: 'owner' } },
      { id: 'u2', data: { uid: 'u2', role: 'police' } },
      { id: 'u3', data: { uid: 'u3', role: 'agent' } },
      { id: 'u4', data: { uid: 'u4', email: 'partial@test.com' } },
      { id: 'u5', data: { uid: 'u5', role: 'owner', roles: ['owner'] } },
    ]);

    const summary = await migrateV4({ firestore } as any);
    expect(summary).toEqual({ migrated: 3, skipped: 2, errors: 0 });
    expect(store.get('u1')).toEqual({ uid: 'u1', role: 'owner', roles: ['owner'] });
    expect(store.get('u2')).toEqual({ uid: 'u2', role: 'police', roles: ['police', 'owner'] });
    expect(store.get('u3')).toEqual({ uid: 'u3', role: 'agent', roles: ['agent', 'owner'] });
    expect(store.get('u4')).toEqual({ uid: 'u4', email: 'partial@test.com' });

    const second = await migrateV4({ firestore } as any);
    expect(second).toEqual({ migrated: 0, skipped: 5, errors: 0 });
  });

  it('v5 performs unmigrated backfill and removes legacy role field idempotently', async () => {
    const customFieldPath = { documentId: vi.fn(() => '__custom_doc_id__') };
    const customFieldValue = { delete: vi.fn(() => '__CUSTOM_DELETE__') };

    const { firestore, store } = createMockFirestore([
      { id: 'u1', data: { uid: 'u1', role: 'police' } },
      { id: 'u2', data: { uid: 'u2', role: 'agent', roles: ['agent', 'owner'] } },
      { id: 'u3', data: { uid: 'u3', roles: ['owner'] } },
    ]);

    const summary = await migrateV5({
      firestore,
      FieldPath: customFieldPath,
      FieldValue: customFieldValue,
    } as any);
    expect(customFieldPath.documentId).toHaveBeenCalled();
    expect(customFieldValue.delete).toHaveBeenCalled();
    expect(summary).toEqual({ backfilled: 1, cleaned: 2, skipped: 1, errors: 0 });
    expect(store.get('u1')).toEqual({ uid: 'u1', roles: ['police', 'owner'] });
    expect(store.get('u2')).toEqual({ uid: 'u2', roles: ['agent', 'owner'] });
    expect(store.get('u3')).toEqual({ uid: 'u3', roles: ['owner'] });

    const second = await migrateV5({ firestore } as any);
    expect(second).toEqual({ backfilled: 0, cleaned: 0, skipped: 3, errors: 0 });
  });
});
