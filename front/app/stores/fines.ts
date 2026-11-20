import { collection, query, where, orderBy, limit } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useCollection, useFirestore } from 'vuefire'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ReportPhoto } from '~/stores/reports'

export type DisputeStatus = 'none' | 'pending' | 'accepted' | 'rejected'

export interface Fine {
  id: string
  reportId: string
  ownerId: string
  plateNumber: string
  amount: number
  status: 'unpaid' | 'paid' | 'cancelled'
  issuedAt: number
  notes?: string
  evidencePhotos?: ReportPhoto[]
  originalPlateNumber?: string
  disputeStatus?: DisputeStatus
  disputeReason?: string
  disputedAt?: number
  resolutionReason?: string
  resolvedAt?: number
}

function getTimestampMillis(ts: any): number {
  if (!ts) return Date.now()
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts.seconds) return ts.seconds * 1000
  if (ts._seconds) return ts._seconds * 1000
  return new Date(ts).getTime()
}

export function normalizeFineFromFirestore(id: string, data: Record<string, any>): Fine {
  return {
    id,
    reportId: data.reportId || '',
    ownerId: data.ownerId || '',
    plateNumber: data.plateNumber || '',
    amount: data.amount || 0,
    status: data.status || 'unpaid',
    issuedAt: getTimestampMillis(data.issuedAt),
    notes: data.notes,
    evidencePhotos: Array.isArray(data.evidencePhotos) ? data.evidencePhotos : undefined,
    originalPlateNumber: data.originalPlateNumber,
    disputeStatus: data.disputeStatus,
    disputeReason: data.disputeReason,
    disputedAt: data.disputedAt ? getTimestampMillis(data.disputedAt) : undefined,
    resolutionReason: data.resolutionReason,
    resolvedAt: data.resolvedAt ? getTimestampMillis(data.resolvedAt) : undefined,
  }
}

const fineConverter = {
  toFirestore(fine: Fine) {
    return fine
  },
  fromFirestore(snapshot: any, options: any): Fine {
    const data = snapshot.data(options)
    return normalizeFineFromFirestore(snapshot.id, data)
  },
}

export const useFinesStore = defineStore('fines', () => {
  const authStore = useAuthStore()
  const userStore = useUserStore()
  const route = useRoute()
  const toast = useToast()
  const db = useFirestore()

  // ── Owner: reactive list of their fines (role + route gated) ─────────────────
  const ownerFinesQuery = computed(() =>
    authStore.currentUser?.uid && userStore.hasRole('owner') && route.meta.role === 'owner'
      ? query(
          collection(db, 'fines').withConverter(fineConverter),
          where('ownerId', '==', authStore.currentUser.uid),
          orderBy('issuedAt', 'desc'),
        )
      : null,
  )
  const { data: myFines, pending: finesLoading } = useCollection(ownerFinesQuery, { ssrKey: 'ownerFines' })

  const hasUnpaidFines = computed(() =>
    myFines.value?.some(f => f.status === 'unpaid') ?? false,
  )

  const acting = ref(false)

  /**
   * Police: issues a fine against a report via Cloud Function.
   */
  async function issueFine(payload: {
    reportId: string
    ownerId: string
    plateNumber: string
    expectedPlateNumber?: string
    amount: number
    notes?: string
  }) {
    acting.value = true
    try {
      const { $functions } = useNuxtApp()
      await httpsCallable($functions, 'issueFine')(payload)
      toast.add({
        title: 'Fine issued!',
        description: `TND ${payload.amount} fine issued for plate ${payload.plateNumber}.`,
        color: 'success',
      })
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to issue fine'
      toast.add({ title: 'Error', description: msg, color: 'error' })
      throw e
    }
    finally {
      acting.value = false
    }
  }

  /**
   * Owner: marks a fine as paid via Cloud Function.
   */
  async function payFine(fineId: string) {
    acting.value = true
    try {
      const { $functions } = useNuxtApp()
      await httpsCallable($functions, 'payFine')({ fineId })
      toast.add({ title: 'Fine marked as paid', color: 'success' })
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to process payment'
      toast.add({ title: 'Error', description: msg, color: 'error' })
      throw e
    }
    finally {
      acting.value = false
    }
  }

  /**
   * Owner: submits a dispute explanation on an unpaid fine via Cloud Function.
   */
  async function disputeFine(fineId: string, reason: string) {
    acting.value = true
    try {
      const { $functions } = useNuxtApp()
      await httpsCallable($functions, 'disputeFine')({ fineId, reason })
      toast.add({ title: 'Dispute submitted', color: 'success' })
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to submit dispute'
      toast.add({ title: 'Error', description: msg, color: 'error' })
      throw e
    }
    finally {
      acting.value = false
    }
  }

  /**
   * Police: resolves a pending dispute via cancel_fine or dismiss_dispute.
   */
  async function resolveDispute(
    fineId: string,
    action: 'cancel_fine' | 'dismiss_dispute',
    reason: string,
  ) {
    acting.value = true
    try {
      const { $functions } = useNuxtApp()
      await httpsCallable($functions, 'resolveDispute')({ fineId, action, reason })
      toast.add({
        title: action === 'cancel_fine' ? 'Fine cancelled' : 'Dispute dismissed',
        color: 'success',
      })
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to resolve dispute'
      toast.add({ title: 'Error', description: msg, color: 'error' })
      throw e
    }
    finally {
      acting.value = false
    }
  }

  // ── Police: reactive list of ALL fines (role + route gated) ──────────────────
  const allFinesQuery = computed(() =>
    authStore.currentUser?.uid && userStore.hasRole('police') && route.meta.role === 'police'
      ? query(
          collection(db, 'fines').withConverter(fineConverter),
          orderBy('issuedAt', 'desc'),
        )
      : null,
  )
  const { data: allFines, pending: allFinesLoading } = useCollection(allFinesQuery, { ssrKey: 'allFines' })

  // ── Police: indexed pending disputes query (role + route gated) ──────────────
  const pendingDisputesQuery = computed(() =>
    authStore.currentUser?.uid && userStore.hasRole('police') && route.meta.role === 'police'
      ? query(
          collection(db, 'fines').withConverter(fineConverter),
          where('disputeStatus', '==', 'pending'),
          orderBy('disputedAt', 'desc'),
          limit(50),
        )
      : null,
  )
  const { data: pendingDisputes, pending: pendingDisputesLoading } = useCollection(
    pendingDisputesQuery,
    { ssrKey: 'pendingDisputes' },
  )

  return {
    myFines,
    finesLoading,
    allFines,
    allFinesLoading,
    pendingDisputes,
    pendingDisputesLoading,
    hasUnpaidFines,
    acting,
    issueFine,
    payFine,
    disputeFine,
    resolveDispute,
  }
})
