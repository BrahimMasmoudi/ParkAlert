import { describe, expect, it, vi } from 'vitest';
import { SetUserRoleUseCase } from '../../src/application/usecases/user/set-user-role';

function createDeps(existingUser: any = null) {
  const userRepository = {
    getById: vi.fn().mockResolvedValue(existingUser),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(),
  };
  const fakeTx = {} as any;
  const transactionRunner = {
    run: vi.fn(async (work: (tx: any) => Promise<any>) => work(fakeTx)),
  };
  const useCase = new SetUserRoleUseCase(userRepository as any, transactionRunner as any);
  return { useCase, userRepository, transactionRunner, fakeTx };
}

describe('SetUserRoleUseCase', () => {
  it('assigns ["owner"] on first onboarding as owner', async () => {
    const { useCase, userRepository, fakeTx } = createDeps(null);
    const result = await useCase.execute({ uid: 'u-1', role: 'owner', name: 'Owner', email: 'o@test.com' });
    expect(result).toEqual({ ok: true, roles: ['owner'] });
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u-1', roles: ['owner'] }),
      fakeTx
    );
  });

  it('assigns ["police", "owner"] on first onboarding as police', async () => {
    const { useCase, userRepository, fakeTx } = createDeps(null);
    const result = await useCase.execute({ uid: 'u-2', role: 'police', name: 'Officer' });
    expect(result).toEqual({ ok: true, roles: ['police', 'owner'] });
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u-2', roles: ['police', 'owner'] }),
      fakeTx
    );
  });

  it('assigns ["agent", "owner"] on first onboarding as agent', async () => {
    const { useCase, userRepository, fakeTx } = createDeps(null);
    const result = await useCase.execute({ uid: 'u-3', role: 'agent', name: 'Agent' });
    expect(result).toEqual({ ok: true, roles: ['agent', 'owner'] });
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u-3', roles: ['agent', 'owner'] }),
      fakeTx
    );
  });

  it('allows setting role when user doc exists as a partial profile without roles', async () => {
    const { useCase, userRepository } = createDeps({ uid: 'u-4', roles: [] });
    const result = await useCase.execute({ uid: 'u-4', role: 'owner' });
    expect(result).toEqual({ ok: true, roles: ['owner'] });
    expect(userRepository.save).toHaveBeenCalledTimes(1);
  });

  it('throws ALREADY_EXISTS when caller already has assigned roles', async () => {
    const { useCase, userRepository } = createDeps({ uid: 'u-1', roles: ['owner'] });
    await expect(useCase.execute({ uid: 'u-1', role: 'police' })).rejects.toMatchObject({
      code: 'ALREADY_EXISTS',
    });
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('throws INVALID_ARGUMENT when role is unsupported', async () => {
    const { useCase, userRepository } = createDeps(null);
    await expect(useCase.execute({ uid: 'u-1', role: 'admin' })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
