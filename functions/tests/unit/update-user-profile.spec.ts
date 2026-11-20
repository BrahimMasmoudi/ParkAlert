import { describe, expect, it, vi } from 'vitest';
import { UpdateUserProfileUseCase } from '../../src/application/usecases/user/update-user-profile';

describe('UpdateUserProfileUseCase', () => {
  it('updates allowed profile fields', async () => {
    const userRepository = {
      getById: vi.fn(),
      save: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new UpdateUserProfileUseCase(userRepository as any);

    const res = await useCase.execute({
      uid: 'u-1',
      fullName: 'Alice Example',
      identityNumber: 'ID-99',
      birthDate: '1990-01-01',
      phone: '+33600000000',
    });

    expect(res).toEqual({ ok: true });
    expect(userRepository.update).toHaveBeenCalledWith('u-1', {
      fullName: 'Alice Example',
      identityNumber: 'ID-99',
      birthDate: '1990-01-01',
      phone: '+33600000000',
    });
  });

  it.each([
    { key: 'roles', payload: { uid: 'u-1', roles: ['police', 'owner'] } },
    { key: 'role', payload: { uid: 'u-1', role: 'police' } },
    { key: 'createdAt', payload: { uid: 'u-1', createdAt: new Date() } },
  ])('throws INVALID_ARGUMENT when disallowed key "$key" is supplied', async ({ payload }) => {
    const userRepository = {
      getById: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };
    const useCase = new UpdateUserProfileUseCase(userRepository as any);

    await expect(useCase.execute(payload as any)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('throws INVALID_ARGUMENT when an allowed optional field is not a string', async () => {
    const userRepository = {
      getById: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };
    const useCase = new UpdateUserProfileUseCase(userRepository as any);

    await expect(
      useCase.execute({ uid: 'u-1', phone: 123456 as any })
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});
