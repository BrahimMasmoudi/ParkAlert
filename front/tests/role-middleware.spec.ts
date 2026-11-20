import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigateTo = vi.fn((path: string) => ({ __redirect: path }))
const mockGetCurrentUser = vi.fn()
const mockGetDoc = vi.fn()

vi.mock('vuefire', () => ({
  getCurrentUser: mockGetCurrentUser,
  useFirestore: () => ({}),
}))

vi.mock('firebase/firestore', () => ({
  doc: (_db: any, col: string, id: string) => ({ col, id }),
  getDoc: mockGetDoc,
}))

let middleware: (to: { path: string }) => Promise<any>

beforeAll(async () => {
  (globalThis as any).defineNuxtRouteMiddleware = (fn: any) => fn
  ;(globalThis as any).navigateTo = mockNavigateTo
  middleware = (await import('../app/middleware/role.global')).default
})

describe('role.global middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows unauthenticated traffic to pass through', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await middleware({ path: '/login' })
    expect(res).toBeUndefined()
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('redirects unonboarded authenticated users to /onboarding without looping on /onboarding', async () => {
    mockGetCurrentUser.mockResolvedValue({ uid: 'u-new' })
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined })

    await expect(middleware({ path: '/owner' })).resolves.toEqual({ __redirect: '/onboarding' })
    await expect(middleware({ path: '/onboarding' })).resolves.toBeUndefined()
  })

  it('redirects already-onboarded users away from /onboarding', async () => {
    mockGetCurrentUser.mockResolvedValue({ uid: 'u-1' })

    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ roles: ['owner'] }) })
    await expect(middleware({ path: '/onboarding' })).resolves.toEqual({ __redirect: '/owner' })

    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ roles: ['police', 'owner'] }) })
    await expect(middleware({ path: '/onboarding' })).resolves.toEqual({ __redirect: '/select-role' })
  })

  it('locks single-role owners to /owner including on /login, /, /select-role, and /police', async () => {
    mockGetCurrentUser.mockResolvedValue({ uid: 'u-owner' })
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ roles: ['owner'] }) })

    for (const path of ['/', '/login', '/select-role', '/police', '/agent']) {
      await expect(middleware({ path })).resolves.toEqual({ __redirect: '/owner' })
    }
    await expect(middleware({ path: '/owner' })).resolves.toBeUndefined()
  })

  it('routes multi-role users from / and /login to /select-role, allows permitted workspaces, and blocks unauthorized workspaces', async () => {
    mockGetCurrentUser.mockResolvedValue({ uid: 'u-pol' })
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ roles: ['police', 'owner'] }) })

    await expect(middleware({ path: '/' })).resolves.toEqual({ __redirect: '/select-role' })
    await expect(middleware({ path: '/login' })).resolves.toEqual({ __redirect: '/select-role' })
    await expect(middleware({ path: '/select-role' })).resolves.toBeUndefined()
    await expect(middleware({ path: '/police' })).resolves.toBeUndefined()
    await expect(middleware({ path: '/owner' })).resolves.toBeUndefined()
    await expect(middleware({ path: '/agent' })).resolves.toEqual({ __redirect: '/select-role' })
  })

  it('orders multi-role array deterministically and treats legacy singular role as unonboarded after Step 4B', async () => {
    mockGetCurrentUser.mockResolvedValue({ uid: 'u-reversed' })
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ roles: ['owner', 'police'] }) })

    await expect(middleware({ path: '/login' })).resolves.toEqual({ __redirect: '/select-role' })
    await expect(middleware({ path: '/owner' })).resolves.toBeUndefined()

    mockGetCurrentUser.mockResolvedValue({ uid: 'u-legacy' })
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: 'police' }) })
    await expect(middleware({ path: '/owner' })).resolves.toEqual({ __redirect: '/onboarding' })
  })
})
