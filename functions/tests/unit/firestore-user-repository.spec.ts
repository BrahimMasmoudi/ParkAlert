import { describe, expect, it, vi } from 'vitest';
import { FirestoreUserRepository } from '../../src/infrastructure/adapters/persistence/FirestoreUserRepository';

function createMockRepo(storedData?: Record<string, any>) {
  const exists = storedData !== undefined;
  const mockGet = vi.fn().mockResolvedValue({
    exists,
    id: 'user-1',
    data: () => storedData,
  });
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockDocRef = { get: mockGet, set: mockSet, update: mockUpdate };

  const connector = {
    db: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => mockDocRef),
      })),
    },
    getFieldValue: () => ({
      serverTimestamp: () => '__SERVER_TIMESTAMP__',
    }),
  } as any;

  return {
    repo: new FirestoreUserRepository(connector),
    mockDocRef,
    mockGet,
    mockSet,
    mockUpdate,
  };
}

describe('FirestoreUserRepository', () => {
  describe('getById roles array extraction', () => {
    it('returns validated roles array from user document', async () => {
      const { repo } = createMockRepo({ uid: 'user-1', roles: ['police', 'owner'], name: 'Officer' });
      const user = await repo.getById('user-1');
      expect(user).toMatchObject({ uid: 'user-1', roles: ['police', 'owner'] });
    });

    it('filters invalid role entries and returns empty array for incomplete documents', async () => {
      const { repo: invalidRepo } = createMockRepo({ uid: 'user-1', roles: ['owner', 'invalid_role'] });
      const filteredUser = await invalidRepo.getById('user-1');
      expect(filteredUser?.roles).toEqual(['owner']);

      const { repo: partialRepo } = createMockRepo({ uid: 'user-1', email: 'partial@test.com' });
      const partialUser = await partialRepo.getById('user-1');
      expect(partialUser?.roles).toEqual([]);
    });

    it('ignores unmigrated legacy singular role after Step 4B cleanup', async () => {
      const { repo } = createMockRepo({ uid: 'user-1', role: 'police', name: 'Legacy' });
      const user = await repo.getById('user-1');
      expect(user?.roles).toEqual([]);
    });
  });

  describe('save createdAt preservation', () => {
    it('sets createdAt when creating a new user document', async () => {
      const { repo, mockSet } = createMockRepo(undefined);
      await repo.save({ uid: 'user-1', roles: ['owner'], email: 'a@test.com', name: 'A' });
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'user-1',
          roles: ['owner'],
          createdAt: '__SERVER_TIMESTAMP__',
        }),
        { merge: true }
      );
    });

    it('preserves existing createdAt when merging onto a partial user document', async () => {
      const { repo, mockSet } = createMockRepo({
        uid: 'user-1',
        createdAt: { seconds: 1700000000 },
      });
      const fakeTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ uid: 'user-1', createdAt: { seconds: 1700000000 } }),
        }),
        set: mockSet,
      } as any;

      await repo.save({ uid: 'user-1', roles: ['police', 'owner'] }, fakeTx);
      const [refArg, payloadArg, optionsArg] = mockSet.mock.calls[0];
      expect(refArg).toBeDefined();
      expect(payloadArg).toEqual({ uid: 'user-1', roles: ['police', 'owner'] });
      expect(payloadArg.createdAt).toBeUndefined();
      expect(optionsArg).toEqual({ merge: true });
    });
  });
});
