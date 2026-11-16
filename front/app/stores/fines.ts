import { collection, query, where, orderBy } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useCollection, useFirestore } from 'vuefire'

export interface Fine {
  id: string
  reportId: string
  ownerId: string
  plateNumber: string
  amount: number
  status: 'unpaid' | 'paid'
  issuedAt: number
  notes?: string
}

function getTimestampMillis(ts: any): number {
  if (!ts) return Date.now()
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts.seconds) return ts.seconds * 1000
  if (ts._seconds) return ts._seconds * 1000
  return new Date(ts).getTime()
}

const fineConverter = {
  toFirestore(fine: Fine) {
    return fine
  },
  fromFirestore(snapshot: any, options: any): Fine {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      reportId: data.reportId || '',
      ownerId: data.ownerId || '',
      plateNumber: data.plateNumber || '',
      amount: data.amount || 0,
      status: data.status || 'unpaid',
      issuedAt: getTimestampMillis(data.issuedAt),
      notes: data.notes
    }
  }
}

export const useFinesStore = defineStore('fines', () => {
  const authStore = useAuthStore()
  const userStore = useUserStore()
  const toast = useToast()
  const db = useFirestore()

  // ── Owner: reactive list of their fines ─────────────────────────────────────
  const ownerFinesQuery = computed(() =>
    authStore.currentUser?.uid
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
    amount: number
    notes?: string
  }) {
    acting.value = true
    try {
      const { $functions } = useNuxtApp()
      await httpsCallable($functions, 'issueFine')(payload)
      toast.add({
        title: 'Fine issued!',
        description: `€${payload.amount} fine issued for plate ${payload.plateNumber}.`,
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

  // ── Police: reactive list of ALL fines (role-gated) ────────────────────────
  const allFinesQuery = computed(() =>
    authStore.currentUser?.uid && userStore.role === 'police'
      ? query(
          collection(db, 'fines').withConverter(fineConverter),
          orderBy('issuedAt', 'desc'),
        )
      : null,
  )
  const { data: allFines, pending: allFinesLoading } = useCollection(allFinesQuery, { ssrKey: 'allFines' })

  return {
    myFines,
    finesLoading,
    allFines,
    allFinesLoading,
    hasUnpaidFines,
    acting,
    issueFine,
    payFine,
  }
})
