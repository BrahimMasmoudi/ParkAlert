import { collection, query, where, orderBy } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'

export interface Fine {
  id: string
  reportId: string
  ownerId: string
  plateNumber: string
  amount: number
  status: 'unpaid' | 'paid'
  issuedAt: string
  notes?: string
}

export const useFinesStore = defineStore('fines', () => {
  const authStore = useAuthStore()
  const toast = useToast()
  const db = useFirestore()

  // ── Owner: reactive list of their fines ─────────────────────────────────────
  const ownerFinesQuery = computed(() =>
    authStore.currentUser?.uid
      ? query(
          collection(db, 'fines'),
          where('ownerId', '==', authStore.currentUser.uid),
          orderBy('issuedAt', 'desc'),
        )
      : null,
  )
  const { data: myFines, pending: finesLoading } = useCollection(ownerFinesQuery)

  const hasUnpaidFines = computed(() =>
    myFines.value?.some(f => f.status === 'unpaid') ?? false,
  )

  const acting = ref(false)

  /**
   * Police: POST /api/fines/issue — issues a fine against a report.
   */
  async function issueFine(payload: {
    reportId: string
    ownerId: string
    plateNumber: string
    amount: number
    notes?: string
  }) {
    acting.value = true
    const token = await authStore.getIdToken()
    try {
      await $fetch('/api/fines/issue', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      })
      toast.add({ title: 'Fine issued!', description: `€${payload.amount} fine issued for plate ${payload.plateNumber}.`, color: 'success' })
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
   * Owner: POST /api/fines/pay — marks a fine as paid.
   */
  async function payFine(fineId: string) {
    acting.value = true
    const token = await authStore.getIdToken()
    try {
      await $fetch('/api/fines/pay', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { fineId },
      })
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

  return {
    myFines,
    finesLoading,
    hasUnpaidFines,
    acting,
    issueFine,
    payFine,
  }
})
