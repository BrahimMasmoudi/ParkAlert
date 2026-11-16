import { ref } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { useCarsStore } from '~/stores/cars'
import type { ReportPhotoSlot } from '~/stores/reports'

export type DocumentKind = 'active' | 'pendingTransfer'

export interface EvidenceUrlItem {
  slot: ReportPhotoSlot
  url: string | null
  expiresAt: number | null
  error?: 'not_found'
}

export const useDocumentViewer = () => {
  const carsStore = useCarsStore()
  const toast = useToast()
  const loadingDoc = ref<string | null>(null)
  const loadingEvidence = ref(false)

  async function resolveDocumentUrl(
    carId: string,
    documentKind: DocumentKind,
    rawPath?: string | null,
  ): Promise<string | null> {
    if (!rawPath) return null
    if (
      rawPath.startsWith('https://')
      || rawPath.startsWith('http://')
      || rawPath.startsWith('data:')
    ) {
      return rawPath
    }
    return await carsStore.getDocumentUrl(carId, documentKind)
  }

  async function openDocument(
    carId: string,
    documentKind: DocumentKind,
    rawPath?: string | null,
  ): Promise<void> {
    if (!rawPath) return
    const key = `${carId}-${documentKind}`
    loadingDoc.value = key
    try {
      const url = await resolveDocumentUrl(carId, documentKind, rawPath)
      if (url && import.meta.client) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }
    catch (error: any) {
      toast.add({
        title: 'Document unavailable',
        description: error?.message || 'Unable to open document',
        color: 'error',
      })
    }
    finally {
      if (loadingDoc.value === key) {
        loadingDoc.value = null
      }
    }
  }

  function isOpening(carId: string, documentKind: DocumentKind): boolean {
    return loadingDoc.value === `${carId}-${documentKind}`
  }

  async function fetchEvidenceUrls(
    targetType: 'report' | 'fine',
    targetId: string,
  ): Promise<EvidenceUrlItem[]> {
    loadingEvidence.value = true
    try {
      const { $functions } = useNuxtApp()
      const fn = httpsCallable<
        { targetType: 'report' | 'fine'; targetId: string },
        { ok: boolean; items: EvidenceUrlItem[] }
      >($functions, 'getEvidenceUrls')
      const res = await fn({ targetType, targetId })
      return res.data?.items ?? []
    }
    catch (error: any) {
      toast.add({
        title: 'Evidence unavailable',
        description: error?.message || 'Unable to load evidence photos',
        color: 'error',
      })
      throw error
    }
    finally {
      loadingEvidence.value = false
    }
  }

  return {
    resolveDocumentUrl,
    openDocument,
    isOpening,
    fetchEvidenceUrls,
    loadingEvidence,
  }
}
