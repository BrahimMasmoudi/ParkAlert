import { collection, query, where } from 'firebase/firestore'
import type { QueryDocumentSnapshot, SnapshotOptions, DocumentData } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useCollection, useFirestore, useCurrentUser } from 'vuefire'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Report {
  id: string
  agentId: string
  plateNumber: string
  location?: { lat: number, lng: number } | null
  photoUrl: string
  status: 'pending' | 'investigated' | 'resolved'
  timestamp: number
  address?: string
}

// Helper Function
function getTimestampMillis(ts: any): number {
  if (!ts) return Date.now()
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts.seconds) return ts.seconds * 1000
  if (ts._seconds) return ts._seconds * 1000
  return new Date(ts).getTime()
}

// ─────────────────────────────────────────────
// FIRESTORE CONVERTER
// Intercepts and cleans data BEFORE Vuefire puts it in the Nuxt payload
// ─────────────────────────────────────────────
const reportConverter = {
  toFirestore(report: Report): DocumentData {
    return report
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Report {
    const data = snapshot.data(options)

    // Create a strict POJO with primitive types only
    return {
      id: snapshot.id,
      agentId: data.agentId || '',
      plateNumber: data.plateNumber || '',
      photoUrl: data.photoUrl || '',
      status: data.status || 'pending',
      address: data.address || '',
      timestamp: getTimestampMillis(data.timestamp),
      location: data.location
        ? {
          lat: data.location.latitude || data.location.lat,
          lng: data.location.longitude || data.location.lng
        }
        : null
    }
  }
}

export const useReportsStore = defineStore('reports', () => {
  const user = useCurrentUser()
  const toast = useToast()
  const db = useFirestore()

  // ─────────────────────────────────────────────
  // 🔥 POLICE: LIVE REPORTS
  // ─────────────────────────────────────────────
  const pendingReportsQuery = computed(() => {
    return query(
      collection(db, 'reports').withConverter(reportConverter),
      where('status', '==', 'pending')
    )
  })

  const {
    data: pendingReports,
    pending: reportsLoading
  } = useCollection(pendingReportsQuery)

  // ─────────────────────────────────────────────
  // 👮 AGENT: THEIR REPORTS
  // ─────────────────────────────────────────────
  const agentReportsQuery = computed(() => {
    const uid = user.value?.uid
    if (!uid) return null

    return query(
      collection(db, 'reports').withConverter(reportConverter),
      where('agentId', '==', uid)
    )
  })

  const {
    data: agentReports,
    pending: agentReportsLoading
  } = useCollection(agentReportsQuery, {
    ssrKey: 'agent-reports'
  })

  // ─────────────────────────────────────────────
  // 📊 STATS
  // ─────────────────────────────────────────────
  const agentTotalReportsCount = computed(() => {
    return agentReports.value?.length || 0
  })

  const agentReportsTodayCount = computed(() => {
    const reports = agentReports.value
    if (!reports?.length) return 0

    const startOfTodayMs = new Date().setHours(0, 0, 0, 0)

    return reports.filter((report) => {
      return report.timestamp >= startOfTodayMs
    }).length
  })

  // ─────────────────────────────────────────────
  // 🚀 CREATE REPORT (Cloud Function)
  // ─────────────────────────────────────────────
  const submitting = ref(false)

  async function createReport(payload: any) {
    submitting.value = true
    try {
      const { $functions } = useNuxtApp()
      const fn = httpsCallable($functions, 'createReport')
      await fn(payload)

      toast.add({
        title: 'Success',
        description: 'Report submitted.',
        color: 'success'
      })
    } catch (e: any) {
      toast.add({
        title: 'Error',
        description: e.message,
        color: 'error'
      })
      throw e
    } finally {
      submitting.value = false
    }
  }

  // ─────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────
  return {
    // live feed
    pendingReports,
    reportsLoading,

    // agent
    agentReports,
    agentReportsLoading,

    // stats
    agentTotalReportsCount,
    agentReportsTodayCount,

    // actions
    createReport,
    submitting
  }
})