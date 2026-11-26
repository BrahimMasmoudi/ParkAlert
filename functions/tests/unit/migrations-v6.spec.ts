import { describe, expect, it, vi } from 'vitest';
import { migrate as migrateV6 } from '../../migrations/v6__backfill_police_audit';

type SeedCollections = Record<string, Record<string, Record<string, any>>>;

function createMockFirestore(initialCollections: SeedCollections) {
  const collections = new Map<string, Map<string, Record<string, any>>>();
  for (const [colName, entries] of Object.entries(initialCollections)) {
    collections.set(
      colName,
      new Map(Object.entries(entries).map(([id, data]) => [id, { ...data }]))
    );
  }

  function ensureCol(colName: string): Map<string, Record<string, any>> {
    let map = collections.get(colName);
    if (!map) {
      map = new Map();
      collections.set(colName, map);
    }
    return map;
  }

  function makeRef(colName: string, docId: string) {
    return {
      id: docId,
      __colName: colName,
      get: vi.fn(async () => {
        const col = ensureCol(colName);
        const data = col.get(docId);
        return {
          id: docId,
          exists: data !== undefined,
          data: () => (data ? { ...data } : undefined),
        };
      }),
    };
  }

  const firestore = {
    collection: vi.fn((colName: string) => {
      const col = ensureCol(colName);
      let filters: Array<{ field: string; value: any }> = [];
      let afterId: string | undefined;
      let maxLimit: number | undefined;

      const chain: any = {
        where: vi.fn((field: string, _op: string, value: any) => {
          filters.push({ field, value });
          return chain;
        }),
        orderBy: vi.fn(() => chain),
        startAfter: vi.fn((docSnap: { id: string }) => {
          afterId = docSnap.id;
          return chain;
        }),
        limit: vi.fn((n: number) => {
          maxLimit = n;
          return chain;
        }),
        doc: vi.fn((docId: string) => makeRef(colName, docId)),
        get: vi.fn(async () => {
          let entries = Array.from(col.entries()).sort(([a], [b]) => a.localeCompare(b));
          for (const f of filters) {
            entries = entries.filter(([, data]) => data[f.field] === f.value);
          }
          if (afterId) {
            const idx = entries.findIndex(([id]) => id === afterId);
            entries = idx >= 0 ? entries.slice(idx + 1) : entries;
          }
          if (typeof maxLimit === 'number') {
            entries = entries.slice(0, maxLimit);
          }
          filters = [];
          afterId = undefined;
          maxLimit = undefined;

          const docs = entries.map(([id, data]) => ({
            id,
            ref: makeRef(colName, id),
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
    getAll: vi.fn(async (...refs: Array<{ id: string; __colName: string }>) =>
      refs.map((ref) => {
        const data = ensureCol(ref.__colName).get(ref.id);
        return {
          id: ref.id,
          exists: data !== undefined,
          data: () => (data ? { ...data } : undefined),
        };
      })
    ),
    batch: vi.fn(() => {
      const ops: Array<{ ref: { id: string; __colName: string }; payload: Record<string, any> }> = [];
      return {
        set: vi.fn((ref: { id: string; __colName: string }, payload: Record<string, any>) => {
          ops.push({ ref, payload });
        }),
        commit: vi.fn(async () => {
          for (const op of ops) {
            ensureCol(op.ref.__colName).set(op.ref.id, { ...op.payload });
          }
        }),
      };
    }),
  };

  return { firestore: firestore as any, collections, ensureCol };
}

describe('v6 police_audit_logs backfill migration (unit)', () => {
  it('backfills enforcement and car police actions with deterministic IDs, skips owner-stage/non-police logs, and is idempotent', async () => {
    const t1 = new Date('2026-11-20T10:00:00Z');
    const t2 = new Date('2026-11-21T10:00:00Z');

    const { firestore, ensureCol } = createMockFirestore({
      users: {
        'pol-1': { uid: 'pol-1', roles: ['police', 'owner'] },
        'owner-1': { uid: 'owner-1', roles: ['owner'] },
        'agent-1': { uid: 'agent-1', roles: ['agent', 'owner'] },
      },
      cars: {
        AB123CD: {
          id: 'AB123CD',
          ownerId: 'owner-1',
          plateNumber: 'AB-123-CD',
          plateNumberNormalized: 'AB123CD',
          status: 'active',
        },
        ARCH01: {
          id: 'ARCH01',
          ownerId: 'owner-arch',
          plateNumber: 'AR-001-CH',
          plateNumberNormalized: 'AR001CH',
          status: 'archived',
        },
      },
      reports: {
        'rep-1': { id: 'rep-1', plateNumber: 'AB-123-CD' },
        'rep-unreg': { id: 'rep-unreg', plateNumber: 'AR-001-CH' },
      },
      fines: {
        'fine-1': {
          id: 'fine-1',
          ownerId: 'owner-1',
          plateNumber: 'AB-123-CD',
          plateNumberNormalized: 'AB123CD',
          originalPlateNumber: 'AB-123-CE',
        },
      },
      enforcement_audit_logs: {
        e1: {
          targetType: 'fine',
          targetId: 'fine-1',
          actorId: 'pol-1',
          action: 'ISSUE_FINE',
          issuedPlate: 'AB-123-CD',
          originalPlate: 'AB-123-CE',
          timestamp: t1,
        },
        e2: {
          targetType: 'report',
          targetId: 'rep-1',
          actorId: 'pol-1',
          action: 'DISMISS_REPORT',
          reason: 'Blurred plate',
          timestamp: t1,
        },
        e3: {
          targetType: 'report',
          targetId: 'rep-unreg',
          actorId: 'pol-1',
          action: 'DISMISS_REPORT',
          reason: 'Archived plate only',
          timestamp: t1,
        },
        e_skip: {
          targetType: 'fine',
          targetId: 'fine-1',
          actorId: 'owner-1',
          action: 'PAY_FINE',
          timestamp: t1,
        },
        e_agent: {
          targetType: 'report',
          targetId: 'rep-1',
          actorId: 'agent-1',
          action: 'UPDATE_REPORT_PLATE',
          timestamp: t1,
        },
      },
      car_audit_logs: {
        c1: {
          carId: 'AB123CD',
          actorId: 'pol-1',
          action: 'APPROVED',
          timestamp: t2,
        },
        c2: {
          carId: 'AB123CD',
          actorId: 'pol-1',
          action: 'TRANSFER_REJECTED',
          reason: 'Forged document',
          details: 'Police rejected transfer',
          timestamp: t2,
        },
        c_owner_cancel: {
          carId: 'AB123CD',
          actorId: 'owner-1',
          action: 'TRANSFER_REJECTED',
          reason: 'Cancelled by seller',
          timestamp: t2,
        },
        c_reg: {
          carId: 'AB123CD',
          actorId: 'owner-1',
          action: 'CAR_REGISTERED',
          timestamp: t2,
        },
      },
    });

    const first = await migrateV6({
      firestore,
      FieldPath: { documentId: () => '__id__' } as any,
    });
    expect(first).toEqual({ created: 5, skipped: 4, errors: 0 });

    const policeAudit = ensureCol('police_audit_logs');
    expect(Array.from(policeAudit.keys()).sort()).toEqual([
      'v6_car_c1',
      'v6_car_c2',
      'v6_enf_e1',
      'v6_enf_e2',
      'v6_enf_e3',
    ]);

    expect(policeAudit.get('v6_enf_e1')).toEqual({
      targetType: 'fine',
      targetId: 'fine-1',
      actorId: 'pol-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      action: 'ISSUE_FINE',
      reason: null,
      metadata: { originalPlateNumber: 'AB-123-CE' },
      timestamp: t1,
    });
    expect(policeAudit.get('v6_enf_e2')).toEqual({
      targetType: 'report',
      targetId: 'rep-1',
      actorId: 'pol-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      action: 'DISMISS_REPORT',
      reason: 'Blurred plate',
      timestamp: t1,
    });
    expect(policeAudit.get('v6_enf_e3')?.ownerId).toBe('');
    expect(policeAudit.get('v6_car_c1')).toEqual({
      targetType: 'car',
      targetId: 'AB123CD',
      actorId: 'pol-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      action: 'CAR_APPROVED',
      reason: null,
      timestamp: t2,
    });
    expect(policeAudit.get('v6_car_c2')).toEqual({
      targetType: 'car',
      targetId: 'AB123CD',
      actorId: 'pol-1',
      ownerId: 'owner-1',
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      action: 'TRANSFER_REJECTED',
      reason: 'Forged document',
      timestamp: t2,
    });

    // Re-running v6 is completely idempotent
    const second = await migrateV6({
      firestore,
      FieldPath: { documentId: () => '__id__' } as any,
    });
    expect(second).toEqual({ created: 0, skipped: 9, errors: 0 });
  });
});
