import { describe, expect, it, vi } from 'vitest';
import { FirestoreCarRepository } from '../../src/infrastructure/adapters/persistence/FirestoreCarRepository';

describe('FirestoreCarRepository.getByPlateNumber', () => {
  it('skips archived and rejected records and returns the active vehicle when plate was re-registered', async () => {
    const docs = [
      { data: () => ({ id: 'AB123CD_old', plateNumberNormalized: 'AB123CD', status: 'archived', ownerId: 'old-owner' }) },
      { data: () => ({ id: 'AB123CD_rej', plateNumberNormalized: 'AB123CD', status: 'rejected', ownerId: 'bad-owner' }) },
      { data: () => ({ id: 'AB123CD_new', plateNumberNormalized: 'AB123CD', status: 'active', ownerId: 'new-owner' }) },
    ];
    const queryChain = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: false, docs }),
    };
    const connector = {
      db: {
        collection: vi.fn().mockReturnValue(queryChain),
      },
      getFieldValue: vi.fn(),
    };

    const repo = new FirestoreCarRepository(connector as any);
    const car = await repo.getByPlateNumber('AB-123-CD');

    expect(car).toMatchObject({ id: 'AB123CD_new', ownerId: 'new-owner', status: 'active' });
    expect(queryChain.where).toHaveBeenCalledWith('plateNumberNormalized', '==', 'AB123CD');
  });

  it('returns null when only archived or rejected records exist', async () => {
    const docs = [
      { data: () => ({ id: 'AB123CD', plateNumberNormalized: 'AB123CD', status: 'archived' }) },
    ];
    const queryChain = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: false, docs }),
    };
    const connector = {
      db: {
        collection: vi.fn().mockReturnValue(queryChain),
      },
      getFieldValue: vi.fn(),
    };

    const repo = new FirestoreCarRepository(connector as any);
    const car = await repo.getByPlateNumber('AB-123-CD');
    expect(car).toBeNull();
  });
});
