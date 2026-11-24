import { doc, getDoc } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import type { CardBrand } from '~/composables/useCardValidation'
import type { FineReceiptSummary } from '~/utils/receiptPdf'

export type OwnerReceiptFetchResult =
  | { status: 'ready'; summary: FineReceiptSummary }
  | { status: 'missing' }

const VALID_CARD_BRANDS = new Set<CardBrand>(['visa', 'mastercard', 'amex', 'discover'])

export function parseReceiptSummary(data: unknown): FineReceiptSummary | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const cardholderName = typeof record.cardholderName === 'string' ? record.cardholderName.trim() : ''
  const cardBrand = typeof record.cardBrand === 'string' ? record.cardBrand : ''
  const cardLast4 = typeof record.cardLast4 === 'string' ? record.cardLast4.trim() : ''

  if (!cardholderName || !VALID_CARD_BRANDS.has(cardBrand as CardBrand) || !/^\d{4}$/.test(cardLast4)) {
    return null
  }

  return {
    cardholderName,
    cardBrand: cardBrand as CardBrand,
    cardLast4,
  }
}

export interface OwnerReceiptFetcherDeps {
  readSummaryDoc: (fineId: string) => Promise<{ exists: boolean; data: unknown }>
  getCurrentUid: () => string | null | undefined
}

export function createOwnerReceiptFetcher(deps: OwnerReceiptFetcherDeps) {
  async function fetchReceiptSummary(
    fineId: string,
    expectedUid: string,
  ): Promise<OwnerReceiptFetchResult> {
    const uidBefore = deps.getCurrentUid()
    if (!expectedUid || !uidBefore || uidBefore !== expectedUid) {
      throw new Error('Authentication state mismatch while fetching receipt summary.')
    }

    const snap = await deps.readSummaryDoc(fineId)

    const uidAfter = deps.getCurrentUid()
    if (!uidAfter || uidAfter !== expectedUid) {
      throw new Error('Authentication state changed while fetching receipt summary.')
    }

    if (!snap.exists) {
      return { status: 'missing' }
    }

    const parsed = parseReceiptSummary(snap.data)
    if (!parsed) {
      return { status: 'missing' }
    }

    return { status: 'ready', summary: parsed }
  }

  return { fetchReceiptSummary }
}

/**
 * Owner-only receipt summary fetcher. Kept separate from useFinesStore and all police views
 * so cardholder PII never enters shared portal state.
 */
export function useOwnerReceipt() {
  const db = useFirestore()
  const authStore = useAuthStore()

  return createOwnerReceiptFetcher({
    getCurrentUid: () => authStore.currentUser?.uid ?? null,
    readSummaryDoc: async (fineId: string) => {
      const snap = await getDoc(doc(db, 'fines', fineId, 'receipt', 'summary'))
      return {
        exists: snap.exists(),
        data: snap.exists() ? snap.data() : null,
      }
    },
  })
}
