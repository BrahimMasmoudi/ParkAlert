import { ref } from 'vue'
import { useCarsStore } from '~/stores/cars'

export type DocumentKind = 'active' | 'pendingTransfer'

export const useDocumentViewer = () => {
  const carsStore = useCarsStore()
  const toast = useToast()
  const loadingDoc = ref<string | null>(null)

  async function resolveDocumentUrl(
    carId: string,
    documentKind: DocumentKind,
    rawPath?: string | null
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
    rawPath?: string | null
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

  return {
    resolveDocumentUrl,
    openDocument,
    isOpening,
  }
}
