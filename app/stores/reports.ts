import { collection, query, where, orderBy } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'

export interface Report {
  id: string
  agentId: string
  plateNumber: string
  location?: { lat: number, lng: number } | null
  photoUrl: string
  status: 'pending' | 'investigated' | 'resolved'
  timestamp: string
  address?: string
}

export const useReportsStore = defineStore('reports', () => {
  const authStore = useAuthStore()
  const toast = useToast()
  const db = useFirestore()

  // ── Police: live feed of pending reports ────────────────────────────────────
  const pendingReportsQuery = computed(() =>
    query(
      collection(db, 'reports'),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc'),
    ),
  )
  const { data: pendingReports, pending: reportsLoading } = useCollection(pendingReportsQuery)

  // ── Submission state ────────────────────────────────────────────────────────
  const submitting = ref(false)

  /**
   * Agent: POST /api/reports — creates a new parking report.
   */
  async function createReport(payload: {
    plateNumber: string
    location?: { lat: number, lng: number } | null
    photoUrl: string
    address?: string
  }) {
    submitting.value = true
    const token = await authStore.getIdToken()
    try {
      await $fetch('/api/reports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      })
      toast.add({ title: 'Report submitted!', description: `Plate ${payload.plateNumber} has been reported.`, color: 'success' })
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to submit report'
      toast.add({ title: 'Submission failed', description: msg, color: 'error' })
      throw e
    }
    finally {
      submitting.value = false
    }
  }

  return {
    pendingReports,
    reportsLoading,
    submitting,
    createReport,
  }
})
