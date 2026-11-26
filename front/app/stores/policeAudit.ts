import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { normalizePlate } from '~/composables/useVehicleValidation'
import { getTimestampMillis } from '~/utils/timestamp'

export const POLICE_AUDIT_PAGE_SIZE = 25

export type PoliceAuditTargetType = 'car' | 'report' | 'fine'
export type PoliceAuditCategory = 'all' | PoliceAuditTargetType
export type PoliceAuditAction =
  | 'CAR_APPROVED'
  | 'CAR_REJECTED'
  | 'CAR_DELETION_APPROVED'
  | 'TRANSFER_APPROVED'
  | 'TRANSFER_REJECTED'
  | 'DISMISS_REPORT'
  | 'ISSUE_FINE'
  | 'CANCEL_FINE'
  | 'DISMISS_DISPUTE'

export interface PoliceAuditEntry {
  id: string
  targetType: PoliceAuditTargetType
  targetId: string
  actorId: string
  ownerId: string
  plateNumber: string
  plateNumberNormalized: string
  action: PoliceAuditAction | string
  reason: string | null
  metadata?: { originalPlateNumber?: string }
  timestamp: number
}

export function normalizePoliceAuditFromFirestore(
  id: string,
  data: Record<string, any>,
): PoliceAuditEntry {
  return {
    id,
    targetType: data.targetType || 'fine',
    targetId: data.targetId || '',
    actorId: data.actorId || '',
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    plateNumber: data.plateNumber || '',
    plateNumberNormalized: data.plateNumberNormalized || '',
    action: data.action || '',
    reason: typeof data.reason === 'string' && data.reason.trim() ? data.reason : null,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
    timestamp: getTimestampMillis(data.timestamp),
  }
}

export const policeAuditConverter = {
  toFirestore(entry: PoliceAuditEntry) {
    return entry
  },
  fromFirestore(snapshot: any, options: any): PoliceAuditEntry {
    const data = snapshot.data(options) || {}
    return normalizePoliceAuditFromFirestore(snapshot.id, data)
  },
}

function collectAuditUserIds(items: PoliceAuditEntry[]): string[] {
  const uids = new Set<string>()
  for (const item of items) {
    if (item.actorId) uids.add(item.actorId)
    if (item.ownerId) uids.add(item.ownerId)
  }
  return Array.from(uids)
}

export const usePoliceAuditStore = defineStore('policeAudit', () => {
  const authStore = useAuthStore()
  const userStore = useUserStore()
  const route = useRoute()
  const db = useFirestore()

  const entries = ref<PoliceAuditEntry[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasLoaded = ref(false)
  const hasMore = ref(false)
  const error = ref<string | null>(null)
  const selectedCategory = ref<PoliceAuditCategory>('all')
  const plateQueryNormalized = ref('')

  let lastDoc: QueryDocumentSnapshot<PoliceAuditEntry> | null = null
  let requestToken = 0

  const isPoliceAuthorized = computed(() =>
    Boolean(authStore.currentUser?.uid && userStore.hasRole('police') && route.meta.role === 'police'),
  )

  function reset() {
    ++requestToken
    entries.value = []
    lastDoc = null
    hasMore.value = false
    hasLoaded.value = false
    loading.value = false
    loadingMore.value = false
    error.value = null
    selectedCategory.value = 'all'
    plateQueryNormalized.value = ''
  }

  watch(isPoliceAuthorized, (allowed) => {
    if (!allowed) {
      reset()
    }
  })

  function buildAuditQuery(
    category: PoliceAuditCategory,
    normalizedPlate: string,
    cursor: QueryDocumentSnapshot<PoliceAuditEntry> | null,
  ) {
    const constraints: QueryConstraint[] = []
    if (normalizedPlate) {
      constraints.push(where('plateNumberNormalized', '==', normalizedPlate))
    }
    if (category !== 'all') {
      constraints.push(where('targetType', '==', category))
    }
    constraints.push(orderBy('timestamp', 'desc'))
    if (cursor) {
      constraints.push(startAfter(cursor))
    }
    constraints.push(limit(POLICE_AUDIT_PAGE_SIZE + 1))

    return query(
      collection(db, 'police_audit_logs').withConverter(policeAuditConverter),
      ...constraints,
    )
  }

  async function fetchFirstPage(options?: {
    category?: PoliceAuditCategory
    plate?: string
  }): Promise<void> {
    if (!isPoliceAuthorized.value) {
      reset()
      return
    }

    if (options?.category !== undefined) {
      selectedCategory.value = options.category
    }
    if (options?.plate !== undefined) {
      plateQueryNormalized.value = normalizePlate(options.plate)
    }

    const token = ++requestToken
    loading.value = true
    error.value = null

    try {
      const snap = await getDocs(
        buildAuditQuery(selectedCategory.value, plateQueryNormalized.value, null),
      )
      if (token !== requestToken || !isPoliceAuthorized.value) return

      const docs = snap.docs as QueryDocumentSnapshot<PoliceAuditEntry>[]
      const nextHasMore = docs.length > POLICE_AUDIT_PAGE_SIZE
      const pageDocs = nextHasMore ? docs.slice(0, POLICE_AUDIT_PAGE_SIZE) : docs
      const nextEntries = pageDocs.map((d) => d.data())

      entries.value = nextEntries
      lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1]! : null
      hasMore.value = nextHasMore
      hasLoaded.value = true

      const uids = collectAuditUserIds(nextEntries)
      if (uids.length > 0) {
        void userStore.fetchUsers(uids)
      }
    }
    catch (err: unknown) {
      if (token !== requestToken || !isPoliceAuthorized.value) return
      error.value = err instanceof Error ? err.message : 'Failed to load police audit logs'
    }
    finally {
      if (token === requestToken) {
        loading.value = false
      }
    }
  }

  async function fetchNextPage(): Promise<void> {
    if (
      !isPoliceAuthorized.value
      || !lastDoc
      || loading.value
      || loadingMore.value
      || !hasMore.value
    ) {
      return
    }

    const token = ++requestToken
    loadingMore.value = true
    error.value = null

    try {
      const snap = await getDocs(
        buildAuditQuery(selectedCategory.value, plateQueryNormalized.value, lastDoc),
      )
      if (token !== requestToken || !isPoliceAuthorized.value) return

      const docs = snap.docs as QueryDocumentSnapshot<PoliceAuditEntry>[]
      const nextHasMore = docs.length > POLICE_AUDIT_PAGE_SIZE
      const pageDocs = nextHasMore ? docs.slice(0, POLICE_AUDIT_PAGE_SIZE) : docs
      const existingIds = new Set(entries.value.map((e) => e.id))
      const appended = pageDocs.map((d) => d.data()).filter((e) => !existingIds.has(e.id))

      if (appended.length > 0) {
        entries.value = [...entries.value, ...appended]
      }
      if (pageDocs.length > 0) {
        lastDoc = pageDocs[pageDocs.length - 1]!
      }
      hasMore.value = nextHasMore

      const uids = collectAuditUserIds(appended)
      if (uids.length > 0) {
        void userStore.fetchUsers(uids)
      }
    }
    catch (err: unknown) {
      if (token !== requestToken || !isPoliceAuthorized.value) return
      error.value = err instanceof Error ? err.message : 'Failed to load more police audit logs'
    }
    finally {
      if (token === requestToken) {
        loadingMore.value = false
      }
    }
  }

  function setCategory(category: PoliceAuditCategory) {
    return fetchFirstPage({ category })
  }

  function searchByPlate(plate: string) {
    return fetchFirstPage({ plate })
  }

  function clearPlateSearch() {
    return fetchFirstPage({ plate: '' })
  }

  return {
    entries,
    loading,
    loadingMore,
    hasLoaded,
    hasMore,
    error,
    selectedCategory,
    plateQueryNormalized,
    isPoliceAuthorized,
    fetchFirstPage,
    fetchNextPage,
    setCategory,
    searchByPlate,
    clearPlateSearch,
    reset,
  }
})
