import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatWaitDuration, getCarQueueTimestamp, parseTimestampMillis } from '../app/utils/timestamp'

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

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockFetchUsers = vi.fn()
const mockRoles = simpleRef<string[]>(['police'])
const mockRouteRole = simpleRef<string | undefined>('police')
const mockUid = simpleRef<string | undefined>('police-1')

vi.mock('vue', () => ({
  ref: simpleRef,
  computed: simpleComputed,
  watch: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db: any, name: string) => ({
    __collection: name,
    withConverter: (conv?: any) => ({ __collection: name, __converter: conv }),
  }),
  doc: (_db: any, col: string, id: string) => ({
    __doc: `${col}/${id}`,
    withConverter: (conv?: any) => ({ __doc: `${col}/${id}`, __converter: conv }),
  }),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  documentId: () => '__name__',
  where: (field: string, op: string, val: any) => ({ __where: [field, op, val] }),
  orderBy: (field: string, dir: string) => ({ __orderBy: [field, dir] }),
  startAfter: (cursor: any) => ({ __startAfter: cursor }),
  limit: (n: number) => ({ __limit: n }),
  query: (...args: any[]) => ({ __query: args }),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: () => vi.fn(),
}))

vi.mock('vuefire', () => ({
  useFirestore: () => ({}),
  useCurrentUser: () => simpleComputed(() => (mockUid.value ? { uid: mockUid.value } : null)),
  useDocument: () => ({ data: simpleRef(undefined), pending: simpleRef(false) }),
  useCollection: () => ({ data: simpleRef([]), pending: simpleRef(false) }),
}))

vi.mock('pinia', () => ({
  defineStore: (_name: string, factory: any) => factory,
}))

vi.mock('~/composables/useVehicleValidation', () => ({
  normalizePlate: (p: string) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
}))

let carConverter: any
let useUserStore: any
let useFinesStore: any
let usePoliceAuditStore: any
let POLICE_AUDIT_PAGE_SIZE: number

beforeAll(async () => {
  ;(globalThis as any).ref = simpleRef
  ;(globalThis as any).computed = simpleComputed
  ;(globalThis as any).watch = vi.fn()
  ;(globalThis as any).defineStore = (_name: string, factory: any) => factory
  ;(globalThis as any).useAuthStore = () => ({
    get currentUser() {
      return mockUid.value ? { uid: mockUid.value } : null
    },
  })
  ;(globalThis as any).useUserStore = () => ({
    hasRole: (r: string) => mockRoles.value.includes(r),
    fetchUsers: mockFetchUsers,
  })
  ;(globalThis as any).useRoute = () => ({
    meta: {
      get role() {
        return mockRouteRole.value
      },
    },
  })
  ;(globalThis as any).useToast = () => ({ add: vi.fn() })
  ;(globalThis as any).useRouter = () => ({ push: vi.fn() })
  ;(globalThis as any).useNuxtApp = () => ({ $functions: {} })

  const carsMod = await import('../app/stores/cars')
  carConverter = carsMod.carConverter
  const userMod = await import('../app/stores/user')
  useUserStore = userMod.useUserStore
  const finesMod = await import('../app/stores/fines')
  useFinesStore = finesMod.useFinesStore
  const policeAuditMod = await import('../app/stores/policeAudit')
  usePoliceAuditStore = policeAuditMod.usePoliceAuditStore
  POLICE_AUDIT_PAGE_SIZE = policeAuditMod.POLICE_AUDIT_PAGE_SIZE
})

beforeEach(() => {
  vi.clearAllMocks()
  mockRoles.value = ['police']
  mockRouteRole.value = 'police'
  mockUid.value = 'police-1'
})

describe('timestamp utilities', () => {
  it('parses numbers, Firestore Timestamps, _seconds objects, ISO strings, and rejects invalid inputs', () => {
    expect(parseTimestampMillis(null)).toBeNull()
    expect(parseTimestampMillis(undefined)).toBeNull()
    expect(parseTimestampMillis('')).toBeNull()
    expect(parseTimestampMillis(123456)).toBe(123456)
    expect(parseTimestampMillis({ toMillis: () => 5000 })).toBe(5000)
    expect(parseTimestampMillis({ seconds: 42 })).toBe(42_000)
    expect(parseTimestampMillis({ _seconds: 10 })).toBe(10_000)
    expect(parseTimestampMillis('2026-01-01T00:00:00.000Z')).toBe(1767225600000)
    expect(parseTimestampMillis('not-a-date')).toBeNull()
  })

  it('formats wait durations and marks >= 24h as stale while clamping future timestamps', () => {
    const now = 10_000_000_000
    expect(formatWaitDuration(now + 5000, now)).toEqual({ bucket: 'just_now', count: 0, isStale: false })
    expect(formatWaitDuration(now - 59_999, now)).toEqual({ bucket: 'just_now', count: 0, isStale: false })
    expect(formatWaitDuration(now - 60_000 * 12, now)).toEqual({ bucket: 'minutes', count: 12, isStale: false })
    expect(formatWaitDuration(now - 3_600_000 * 5, now)).toEqual({ bucket: 'hours', count: 5, isStale: false })
    expect(formatWaitDuration(now - 86_400_000, now)).toEqual({ bucket: 'days', count: 1, isStale: true })
  })

  it('resolves car queue timestamps per workflow with fallbacks', () => {
    expect(getCarQueueTimestamp({ createdAt: 100, updatedAt: 200 }, 'activation')).toBe(200)
    expect(getCarQueueTimestamp({ createdAt: 100 }, 'activation')).toBe(100)
    expect(getCarQueueTimestamp({ createdAt: 100, updatedAt: 200, deletionRequestedAt: 300 }, 'deletion')).toBe(300)
    expect(getCarQueueTimestamp({ createdAt: 100, updatedAt: 200 }, 'deletion')).toBe(200)
    expect(getCarQueueTimestamp({ createdAt: 100 }, 'deletion')).toBe(100)
    expect(getCarQueueTimestamp({ createdAt: 100, transferRequestedAt: 150, updatedAt: 250 }, 'transfer')).toBe(250)
    expect(getCarQueueTimestamp({ createdAt: 100, transferRequestedAt: 150 }, 'transfer')).toBe(150)
    expect(getCarQueueTimestamp({ createdAt: 100 }, 'transfer')).toBe(100)
  })
})

describe('carConverter optional timestamps & queue tie-breaking', () => {
  it('maps absent updatedAt/deletionRequestedAt/transferRequestedAt as undefined instead of Date.now()', () => {
    const converted = carConverter.fromFirestore(
      {
        id: 'AB123CD',
        data: () => ({
          ownerId: 'owner-1',
          plateNumber: 'AB-123-CD',
          brand: 'Renault',
          model: 'Clio',
          color: 'White',
          status: 'activation_pending',
          createdAt: { seconds: 1000 },
        }),
      },
      {},
    )
    expect(converted.createdAt).toBe(1_000_000)
    expect(converted.updatedAt).toBeUndefined()
    expect(converted.deletionRequestedAt).toBeUndefined()
    expect(converted.transferRequestedAt).toBeUndefined()
    expect(getCarQueueTimestamp(converted, 'activation')).toBe(1_000_000)
  })

  it('sorts queue items deterministically with ascending id tie-breaker regardless of sortOrder', () => {
    const sortByTs = (items: Array<{ id: string; ts: number }>, order: 'asc' | 'desc') =>
      [...items].sort((a, b) => {
        const diff = a.ts - b.ts
        if (diff !== 0) return order === 'asc' ? diff : -diff
        return a.id.localeCompare(b.id)
      })

    const sample = [
      { id: 'c', ts: 200 },
      { id: 'b', ts: 100 },
      { id: 'a', ts: 100 },
    ]
    expect(sortByTs(sample, 'asc').map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(sortByTs(sample, 'desc').map(x => x.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('userStore.fetchUsers', () => {
  it('batches in chunks of 30, caches Unknown User via QuerySnapshot diff, awaits concurrent fetches, and retries errors', async () => {
    const store = useUserStore()
    const uids = Array.from({ length: 32 }, (_, i) => `u-${i}`)

    mockGetDocs
      .mockResolvedValueOnce({
        docs: [{ id: 'u-0', data: () => ({ name: 'Alice' }) }],
      })
      .mockResolvedValueOnce({
        docs: [{ id: 'u-30', data: () => ({ name: 'Bob' }) }],
      })

    await store.fetchUsers(uids)
    expect(mockGetDocs).toHaveBeenCalledTimes(2)
    expect(store.usersCache.value['u-0']).toEqual({ id: 'u-0', name: 'Alice' })
    expect(store.usersCache.value['u-1']).toEqual({ name: 'Unknown User' })
    expect(store.usersCache.value['u-30']).toEqual({ id: 'u-30', name: 'Bob' })
    expect(store.usersCache.value['u-31']).toEqual({ name: 'Unknown User' })

    // Concurrent await fetchUser shares active fetch promise instead of resolving with _loading
    let resolveDeferred!: (v: any) => void
    mockGetDocs.mockReturnValueOnce(new Promise((resolve) => { resolveDeferred = resolve }))
    const p1 = store.fetchUsers(['u-concurrent'])
    const p2 = store.fetchUser('u-concurrent')
    expect(store.usersCache.value['u-concurrent']).toEqual({ _loading: true })
    resolveDeferred({ docs: [{ id: 'u-concurrent', data: () => ({ name: 'Carol' }) }] })
    const [, userResult] = await Promise.all([p1, p2])
    expect(userResult).toEqual({ id: 'u-concurrent', name: 'Carol' })

    // Transient failure clears _loading without caching Unknown User so retry succeeds
    mockGetDocs.mockRejectedValueOnce(new Error('network'))
    await store.fetchUsers(['u-flaky'])
    expect(store.usersCache.value['u-flaky']).toBeUndefined()

    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'u-flaky', data: () => ({ name: 'Recovered' }) }] })
    await store.fetchUsers(['u-flaky'])
    expect(store.usersCache.value['u-flaky']).toEqual({ id: 'u-flaky', name: 'Recovered' })
  })
})

describe('finesStore point receipt lookups', () => {
  it('fetches fines by id and paymentReference with empty-string and role guards', async () => {
    const store = useFinesStore()

    expect(await store.fetchFineById('   ')).toBeNull()
    expect(await store.fetchFineByPaymentReference('')).toBeNull()
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(mockGetDocs).not.toHaveBeenCalled()

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ id: 'fine-1', status: 'paid', paymentReference: 'PA-2026-XYZ' }),
    })
    const byId = await store.fetchFineById(' fine-1 ')
    expect(byId).toMatchObject({ id: 'fine-1', status: 'paid' })
    expect(mockGetDoc).toHaveBeenCalledWith(expect.objectContaining({ __doc: 'fines/fine-1' }))

    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{ data: () => ({ id: 'fine-2', status: 'paid', paymentReference: 'PA-2026-XYZ' }) }],
    })
    const byRef = await store.fetchFineByPaymentReference(' PA-2026-XYZ ')
    expect(byRef).toMatchObject({ id: 'fine-2' })
    const qArgs = mockGetDocs.mock.calls[0]![0].__query
    expect(qArgs).toContainEqual({ __where: ['paymentReference', '==', 'PA-2026-XYZ'] })
    expect(qArgs).toContainEqual({ __limit: 1 })
  })
})

describe('usePoliceAuditStore', () => {
  function makeSnapDoc(id: string, overrides: Record<string, any> = {}) {
    const entry = {
      id,
      targetType: 'fine',
      targetId: `target-${id}`,
      actorId: `pol-${id}`,
      ownerId: `owner-${id}`,
      plateNumber: 'AB-123-CD',
      plateNumberNormalized: 'AB123CD',
      action: 'ISSUE_FINE',
      reason: null,
      timestamp: 5000,
      ...overrides,
    }
    return {
      id,
      data: () => entry,
    }
  }

  it('builds filtered queries, paginates with startAfter cursor, batches users, and preserves entries on errors', async () => {
    const store = usePoliceAuditStore()
    const firstBatch = Array.from({ length: POLICE_AUDIT_PAGE_SIZE + 1 }, (_, i) =>
      makeSnapDoc(`doc-${i}`, { actorId: 'pol-shared', ownerId: i === 0 ? '' : `owner-${i}` }),
    )
    mockGetDocs.mockResolvedValueOnce({ docs: firstBatch })

    await store.fetchFirstPage({ category: 'fine', plate: ' ab-123-cd ' })

    const q1 = mockGetDocs.mock.calls[0]![0].__query
    expect(q1).toContainEqual({ __where: ['plateNumberNormalized', '==', 'AB123CD'] })
    expect(q1).toContainEqual({ __where: ['targetType', '==', 'fine'] })
    expect(q1).toContainEqual({ __orderBy: ['timestamp', 'desc'] })
    expect(q1).toContainEqual({ __limit: POLICE_AUDIT_PAGE_SIZE + 1 })
    expect(store.entries.value).toHaveLength(POLICE_AUDIT_PAGE_SIZE)
    expect(store.hasMore.value).toBe(true)
    expect(store.hasLoaded.value).toBe(true)
    expect(mockFetchUsers).toHaveBeenCalledTimes(1)
    const fetchedUids = mockFetchUsers.mock.calls[0]![0] as string[]
    expect(fetchedUids).not.toContain('')
    expect(fetchedUids.filter(u => u === 'pol-shared')).toHaveLength(1)

    // Subsequent fetchNextPage error retains existing entries and sets error
    mockGetDocs.mockRejectedValueOnce(new Error('offline'))
    await store.fetchNextPage()
    expect(store.error.value).toBe('offline')
    expect(store.entries.value).toHaveLength(POLICE_AUDIT_PAGE_SIZE)
    expect(store.hasMore.value).toBe(true)

    // Retry fetchNextPage succeeds and appends without duplicates
    mockGetDocs.mockResolvedValueOnce({
      docs: [makeSnapDoc('doc-25')],
    })
    await store.fetchNextPage()
    expect(store.error.value).toBeNull()
    expect(store.entries.value).toHaveLength(POLICE_AUDIT_PAGE_SIZE + 1)
    expect(store.hasMore.value).toBe(false)
    const q2 = mockGetDocs.mock.calls[2]![0].__query
    expect(q2.some((p: any) => p.__startAfter?.id === `doc-${POLICE_AUDIT_PAGE_SIZE - 1}`)).toBe(true)
  })

  it('drops stale out-of-order responses using monotonic requestToken', async () => {
    const store = usePoliceAuditStore()
    let resolveSlow!: (v: any) => void
    mockGetDocs.mockReturnValueOnce(new Promise((resolve) => { resolveSlow = resolve }))

    const pSlow = store.setCategory('car')
    mockGetDocs.mockResolvedValueOnce({
      docs: [makeSnapDoc('fresh-report', { targetType: 'report', action: 'DISMISS_REPORT' })],
    })
    const pFast = store.setCategory('report')

    await pFast
    expect(store.entries.value.map((e: any) => e.id)).toEqual(['fresh-report'])

    resolveSlow({ docs: [makeSnapDoc('stale-car', { targetType: 'car', action: 'CAR_APPROVED' })] })
    await pSlow
    expect(store.entries.value.map((e: any) => e.id)).toEqual(['fresh-report'])
  })
})
