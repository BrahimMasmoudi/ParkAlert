import { collection, query, where } from 'firebase/firestore'
import type { QueryDocumentSnapshot, SnapshotOptions, DocumentData } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useCollection, useFirestore, useCurrentUser } from 'vuefire'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type ReportPhotoSlot = 'context' | 'plate' | 'extra'

export interface ReportPhoto {
  path: string
  slot: ReportPhotoSlot
}

export interface Report {
  id: string
  agentId: string
  plateNumber: string
  location?: { lat: number; lng: number } | null
  photos: ReportPhoto[]
  photoUrl: string
  status: 'pending' | 'investigated' | 'resolved'
  originalPlateNumber?: string
  plateCorrectedBy?: string
  plateCorrectedAt?: number
  resolutionReason?: string
  resolvedBy?: string
  resolvedAt?: number
  timestamp: number
  address?: string
}

function getTimestampMillis(ts: any): number {
  if (!ts) return Date.now()
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts.seconds) return ts.seconds * 1000
  if (ts._seconds) return ts._seconds * 1000
  return new Date(ts).getTime()
}

export function normalizeReportFromFirestore(id: string, data: DocumentData): Report {
  const legacyUrl = typeof data.photoUrl === 'string' ? data.photoUrl.trim() : ''
  const rawPhotos = Array.isArray(data.photos) ? data.photos : []
  const photos: ReportPhoto[] = rawPhotos.length > 0
    ? rawPhotos.filter((p: any) => p && typeof p.path === 'string' && typeof p.slot === 'string')
    : (legacyUrl ? [{ path: legacyUrl, slot: 'context' as const }] : [])

  return {
    id,
    agentId: data.agentId || '',
    plateNumber: data.plateNumber || '',
    photos,
    photoUrl: legacyUrl,
    status: data.status || 'pending',
    originalPlateNumber: data.originalPlateNumber || undefined,
    plateCorrectedBy: data.plateCorrectedBy || undefined,
    plateCorrectedAt: data.plateCorrectedAt ? getTimestampMillis(data.plateCorrectedAt) : undefined,
    resolutionReason: data.resolutionReason || undefined,
    resolvedBy: data.resolvedBy || undefined,
    resolvedAt: data.resolvedAt ? getTimestampMillis(data.resolvedAt) : undefined,
    address: data.address || '',
    timestamp: getTimestampMillis(data.timestamp),
    location: data.location
      ? {
          lat: data.location.latitude ?? data.location.lat,
          lng: data.location.longitude ?? data.location.lng,
        }
      : null,
  }
}

const reportConverter = {
  toFirestore(report: Report): DocumentData {
    return report
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Report {
    return normalizeReportFromFirestore(snapshot.id, snapshot.data(options))
  },
}

export const useReportsStore = defineStore('reports', () => {
  const user = useCurrentUser()
  const toast = useToast()
  const db = useFirestore()

  const pendingReportsQuery = computed(() => {
    return query(
      collection(db, 'reports').withConverter(reportConverter),
      where('status', '==', 'pending'),
    )
  })

  const {
    data: pendingReports,
    pending: reportsLoading,
  } = useCollection(pendingReportsQuery, { ssrKey: 'pendingReports' })

  const agentReportsQuery = computed(() => {
    const uid = user.value?.uid
    if (!uid) return null

    return query(
      collection(db, 'reports').withConverter(reportConverter),
      where('agentId', '==', uid),
    )
  })

  const {
    data: agentReports,
    pending: agentReportsLoading,
  } = useCollection(agentReportsQuery, {
    ssrKey: 'agent-reports',
  })

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

  const submitting = ref(false)
  const actingIds = ref<Set<string>>(new Set())

  function isActing(id: string) {
    return actingIds.value.has(id)
  }

  async function callFn(name: string, payload?: any) {
    const { $functions } = useNuxtApp()
    const fn = httpsCallable($functions, name)
    return await fn(payload)
  }

  async function withActing<T>(id: string, fn: () => Promise<T>): Promise<T> {
    actingIds.value.add(id)
    try {
      return await fn()
    }
    finally {
      actingIds.value.delete(id)
    }
  }

  async function createReport(payload: {
    plateNumber: string
    location?: { lat: number; lng: number } | null
    photos: ReportPhoto[]
    address?: string
  }) {
    submitting.value = true
    try {
      await callFn('createReport', payload)
      toast.add({
        title: 'Success',
        description: 'Report submitted.',
        color: 'success',
      })
    }
    catch (e: any) {
      toast.add({
        title: 'Error',
        description: e?.message || 'Failed to submit report',
        color: 'error',
      })
      throw e
    }
    finally {
      submitting.value = false
    }
  }

  async function updatePendingReportPlate(reportId: string, plateNumber: string) {
    return withActing(reportId, async () => {
      try {
        await callFn('updatePendingReportPlate', { reportId, plateNumber })
        toast.add({
          title: 'Success',
          description: 'Plate number updated.',
          color: 'success',
        })
      }
      catch (e: any) {
        toast.add({
          title: 'Error',
          description: e?.message || 'Failed to update plate number',
          color: 'error',
        })
        throw e
      }
    })
  }

  async function dismissReport(reportId: string, reason: string) {
    return withActing(reportId, async () => {
      try {
        await callFn('dismissReport', { reportId, reason })
        toast.add({
          title: 'Report dismissed',
          color: 'warning',
        })
      }
      catch (e: any) {
        toast.add({
          title: 'Error',
          description: e?.message || 'Failed to dismiss report',
          color: 'error',
        })
        throw e
      }
    })
  }

  return {
    pendingReports,
    reportsLoading,
    agentReports,
    agentReportsLoading,
    agentTotalReportsCount,
    agentReportsTodayCount,
    createReport,
    updatePendingReportPlate,
    dismissReport,
    isActing,
    submitting,
  }
})
