import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useCollection, useFirestore } from 'vuefire'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ReportPhoto } from '~/stores/reports'
import type { CardBrand } from '~/composables/useCardValidation'
import { getOptionalTimestampMillis, getTimestampMillis } from '~/utils/timestamp'

export type DisputeStatus = 'none' | 'pending' | 'accepted' | 'rejected'

export interface Fine {
  id: string
  reportId: string
  ownerId: string
  plateNumber: string
  amount: number
  status: 'unpaid' | 'paid' | 'cancelled'
  issuedAt: number
  paidAt?: number
  paymentReference?: string
  paymentProvider?: string
  paymentAttemptId?: string
  notes?: string
  evidencePhotos?: ReportPhoto[]
  originalPlateNumber?: string
  disputeStatus?: DisputeStatus
  disputeReason?: string
  disputedAt?: number
  resolutionReason?: string
  resolvedAt?: number
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
    paidAt: getOptionalTimestampMillis(data.paidAt),
    paymentReference: data.paymentReference,
    paymentProvider: data.paymentProvider,
    paymentAttemptId: data.paymentAttemptId,
    notes: data.notes,
    evidencePhotos: Array.isArray(data.evidencePhotos) ? data.evidencePhotos : undefined,
    originalPlateNumber: data.originalPlateNumber,
    disputeStatus: data.disputeStatus,
    disputeReason: data.disputeReason,
    disputedAt: getOptionalTimestampMillis(data.disputedAt),
    resolutionReason: data.resolutionReason,
    resolvedAt: getOptionalTimestampMillis(data.resolvedAt),
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
   * Owner: settles an unpaid fine via Cloud Function with validated payment summary metadata.
   */
  async function payFine(payload: {
    fineId: string
    cardholderName: string
    cardBrand: CardBrand
    cardLast4: string
    paymentAttemptId: string
  }): Promise<{ ok: true; paymentReference: string }> {
    const { $functions } = useNuxtApp()
    const callable = httpsCallable<
      typeof payload,
      { ok: true; paymentReference: string }
    >($functions, 'payFine', { timeout: 20_000 })
    const result = await callable(payload)
    return result.data
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

  // ── Police: point-lookup helpers for audit receipts (role + route gated) ──────
  async function fetchFineById(fineId: string): Promise<Fine | null> {
    const trimmed = fineId.trim()
    if (!trimmed) return null
    if (!authStore.currentUser?.uid || !userStore.hasRole('police') || route.meta.role !== 'police') {
      return null
    }
    const snap = await getDoc(doc(db, 'fines', trimmed).withConverter(fineConverter))
    return snap.exists() ? snap.data() : null
  }

  async function fetchFineByPaymentReference(paymentRef: string): Promise<Fine | null> {
    const trimmed = paymentRef.trim()
    if (!trimmed) return null
    if (!authStore.currentUser?.uid || !userStore.hasRole('police') || route.meta.role !== 'police') {
      return null
    }
    const snap = await getDocs(
      query(
        collection(db, 'fines').withConverter(fineConverter),
        where('paymentReference', '==', trimmed),
        limit(1),
      ),
    )
    if (snap.empty) return null
    return snap.docs[0]!.data()
  }

  // ── Police: indexed pending disputes query (role + route gated) ──────────────
  const pendingDisputesQuery = computed(() =>
    authStore.currentUser?.uid && userStore.hasRole('police') && route.meta.role === 'police'
      ? query(
          collection(db, 'fines').withConverter(fineConverter),
          where('disputeStatus', '==', 'pending'),
          orderBy('disputedAt', 'asc'),
          limit(250),
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
    pendingDisputes,
    pendingDisputesLoading,
    hasUnpaidFines,
    acting,
    fetchFineById,
    fetchFineByPaymentReference,
    issueFine,
    payFine,
    disputeFine,
    resolveDispute,
  }
})
