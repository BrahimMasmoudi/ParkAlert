import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserRole } from '../app/utils/roles'

function simpleRef<T>(initial: T) {
  return { value: initial }
}

function simpleComputed<T>(getter: () => T) {
  return {
    get value() {
      return getter()
    },
  }
}

const mockQueries: any[] = []
const mockGetDocs = vi.fn()
const mockWatchCallbacks: Array<{ source: () => any; cb: (val: any) => void }> = []
const mockRoles = simpleRef<UserRole[]>(['owner'])
const mockRouteRole = simpleRef<UserRole | undefined>('owner')
const mockUid = simpleRef<string | undefined>('user-1')
const mockUserDocData = simpleRef<Record<string, any> | undefined>({ roles: ['owner'] })
const mockRouterPush = vi.fn()

vi.mock('vue', () => ({
  ref: simpleRef,
  computed: simpleComputed,
  watch: (source: () => any, cb: (val: any) => void) => {
    mockWatchCallbacks.push({ source, cb })
    return vi.fn()
  },
}))

vi.mock('~/composables/useVehicleValidation', () => ({
  normalizePlate: (p: string) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db: any, name: string) => ({
    __collection: name,
    withConverter: () => ({ __collection: name }),
  }),
  doc: (_db: any, col: string, id: string) => ({ __doc: `${col}/${id}` }),
  getDoc: vi.fn(),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  documentId: () => '__name__',
  where: (field: string, op: string, val: any) => ({ __where: [field, op, val] }),
  orderBy: (field: string, dir: string) => ({ __orderBy: [field, dir] }),
  startAfter: (cursor: any) => ({ __startAfter: cursor }),
  limit: (n: number) => ({ __limit: n }),
  query: (...args: any[]) => {
    const q = { __query: args }
    mockQueries.push(q)
    return q
  },
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: () => vi.fn(),
}))

vi.mock('vuefire', () => ({
  useFirestore: () => ({}),
  useCurrentUser: () => simpleComputed(() => (mockUid.value ? { uid: mockUid.value } : null)),
  useDocument: () => ({
    data: mockUserDocData,
    pending: simpleRef(false),
  }),
  useCollection: (source: any) => {
    const data = simpleRef([])
    const pending = simpleRef(false)
    const _evaluated = typeof source === 'function' ? source() : source?.value
    return { data, pending, _evaluated }
  },
}))

vi.mock('pinia', () => ({
  defineStore: (_id: string, setup: () => any) => setup,
}))

let useUserStore: () => any
let useCarsStore: () => any
let useFinesStore: () => any
let useReportsStore: () => any
let usePoliceAuditStore: () => any

beforeAll(async () => {
  (globalThis as any).computed = simpleComputed
  ;(globalThis as any).ref = simpleRef
  ;(globalThis as any).watch = (source: () => any, cb: (val: any) => void) => {
    mockWatchCallbacks.push({ source, cb })
    return vi.fn()
  }
  ;(globalThis as any).defineStore = (_id: string, setup: () => any) => setup
  ;(globalThis as any).useRoute = () => ({
    meta: {
      get role() {
        return mockRouteRole.value
      },
    },
  })
  ;(globalThis as any).useRouter = () => ({ push: mockRouterPush })
  ;(globalThis as any).useAuthStore = () => ({
    get currentUser() {
      return mockUid.value ? { uid: mockUid.value } : null
    },
  })
  ;(globalThis as any).useUserStore = () => ({
    get roles() {
      return mockRoles.value
    },
    hasRole(role: UserRole) {
      return mockRoles.value.includes(role)
    },
    fetchUsers: vi.fn(),
  })
  ;(globalThis as any).useToast = () => ({ add: vi.fn() })
  ;(globalThis as any).useNuxtApp = () => ({ $functions: {} })

  ;({ useUserStore } = await import('../app/stores/user'))
  ;({ useCarsStore } = await import('../app/stores/cars'))
  ;({ useFinesStore } = await import('../app/stores/fines'))
  ;({ useReportsStore } = await import('../app/stores/reports'))
  ;({ usePoliceAuditStore } = await import('../app/stores/policeAudit'))
})

describe('Pinia Store Dual Gating (roles + route.meta.role) & User Store', () => {
  beforeEach(() => {
    mockQueries.length = 0
    mockWatchCallbacks.length = 0
    mockGetDocs.mockReset()
    mockUid.value = 'user-1'
    mockRouteRole.value = 'owner'
    mockRoles.value = ['owner']
  })

  it('resolves sorted roles in useUserStore and opens no users collection queries', () => {
    mockUserDocData.value = { roles: ['owner', 'police'] }
    const userStore = useUserStore()

    expect(userStore.roles.value).toEqual(['police', 'owner'])
    expect(userStore.isMultiRole.value).toBe(true)
    expect(userStore.hasRole('police')).toBe(true)
    expect(userStore.hasRole('owner')).toBe(true)
    expect(userStore.hasRole('agent')).toBe(false)
    expect(userStore.availableOwners).toBeUndefined()
    expect(mockQueries).toHaveLength(0)

    // Legacy singular role field is ignored after Step 4B cleanup
    mockUserDocData.value = { role: 'police' }
    expect(userStore.roles.value).toEqual([])
  })

  it('subscribes only to owner listeners when a multi-role police user is on /owner', () => {
    mockRoles.value = ['police', 'owner']
    mockRouteRole.value = 'owner'

    const carsStore = useCarsStore()
    useFinesStore()
    useReportsStore()

    expect((carsStore as any).historicalCars).toBeUndefined()
    const queriedCollections = mockQueries.map(q => q.__query[0].__collection)
    expect(queriedCollections).toEqual(['cars', 'fines'])
    expect(mockQueries[0].__query.some((part: any) => part.__where?.[0] === 'ownerId')).toBe(true)
    expect(mockQueries[1].__query.some((part: any) => part.__where?.[0] === 'ownerId')).toBe(true)
  })

  it('subscribes only to police listeners when a multi-role police user is on /police', () => {
    mockRoles.value = ['police', 'owner']
    mockRouteRole.value = 'police'

    useCarsStore()
    const finesStore = useFinesStore()
    useReportsStore()

    expect(finesStore.allFines).toBeUndefined()
    const queriedCollections = mockQueries.map(q => q.__query[0].__collection)
    expect(queriedCollections).toEqual(['cars', 'fines', 'reports'])
    const pendingCarsQuery = mockQueries.find(q => q.__query[0].__collection === 'cars')
    const statusWhere = pendingCarsQuery.__query.find((part: any) => part.__where?.[0] === 'status')
    expect(statusWhere.__where[2]).toEqual([
      'activation_pending',
      'deletion_requested',
      'transfer_pending_police',
    ])
    expect(statusWhere.__where[2]).not.toContain('transfer_pending_owner')
  })

  it('subscribes only to agent reports listener when a multi-role agent user is on /agent', () => {
    mockRoles.value = ['agent', 'owner']
    mockRouteRole.value = 'agent'

    useCarsStore()
    useFinesStore()
    useReportsStore()

    const queriedCollections = mockQueries.map(q => q.__query[0].__collection)
    expect(queriedCollections).toEqual(['reports'])
    expect(mockQueries[0].__query.some((part: any) => part.__where?.[0] === 'agentId')).toBe(true)
  })

  it('dual-gates usePoliceAuditStore and resets state when role/route/auth drops', async () => {
    mockRoles.value = ['police', 'owner']
    mockRouteRole.value = 'owner'

    const auditStore = usePoliceAuditStore()
    await auditStore.fetchFirstPage()
    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(auditStore.hasLoaded.value).toBe(false)

    mockRouteRole.value = 'police'
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'log-1',
          data: () => ({
            targetType: 'fine',
            targetId: 'fine-1',
            actorId: 'user-1',
            ownerId: 'owner-1',
            plateNumber: 'AB-123-CD',
            plateNumberNormalized: 'AB123CD',
            action: 'ISSUE_FINE',
            reason: null,
            timestamp: 1000,
          }),
        },
      ],
    })
    await auditStore.fetchFirstPage()
    expect(mockGetDocs).toHaveBeenCalledTimes(1)
    expect(auditStore.entries.value).toHaveLength(1)
    expect(auditStore.hasLoaded.value).toBe(true)

    // Switch off /police -> watcher resets all cached entries
    mockRouteRole.value = 'owner'
    mockWatchCallbacks.forEach(w => w.cb(typeof w.source === 'function' ? w.source() : w.source.value))
    expect(auditStore.entries.value).toEqual([])
    expect(auditStore.hasLoaded.value).toBe(false)
    expect(auditStore.hasMore.value).toBe(false)
  })
})
