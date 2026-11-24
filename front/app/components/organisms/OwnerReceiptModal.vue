<template>
  <UModal
    v-model:open="open"
    :title="$t('owner.fines.receipt_modal.title')"
    :description="$t('owner.fines.receipt_modal.description')"
    :ui="{
      content: 'max-w-xl',
      body: 'p-4 sm:p-6 space-y-4',
    }"
  >
    <template #body>
      <UAlert
        v-if="locale === 'ar'"
        color="info"
        variant="subtle"
        icon="i-lucide-languages"
        :description="$t('owner.fines.receipt_modal.arabic_fallback_notice')"
      />

      <MoleculesFineReceiptCard
        v-if="viewModel"
        :view-model="viewModel"
        :copy="viewModel.copy"
        :summary-state="summaryState"
        @retry="loadSummary"
      />
    </template>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <UButton
          :label="$t('common.close')"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          :label="downloading ? $t('owner.fines.receipt_modal.downloading_button') : $t('owner.fines.receipt_modal.download_button')"
          color="primary"
          icon="i-lucide-download"
          :loading="downloading"
          :disabled="!viewModel || downloading || summaryState === 'loading' || !hasPaymentReference"
          @click="handleDownloadPdf"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Fine } from '~/stores/fines'
import type { FineReceiptSummary, ReceiptSummaryState } from '~/utils/receiptPdf'
import { buildReceiptViewModel, downloadReceiptPdf, loadPdfMake } from '~/utils/receiptPdf'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  fine: Fine | null
}>()

const { locale, t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const { fetchReceiptSummary } = useOwnerReceipt()

const summaryState = ref<ReceiptSummaryState>('idle')
const receiptSummary = ref<FineReceiptSummary | null>(null)
const downloading = ref(false)
let activeRequestNonce = 0

const hasPaymentReference = computed(() => Boolean(props.fine?.paymentReference?.trim()))

const viewModel = computed(() => {
  if (!props.fine) return null
  return buildReceiptViewModel(
    props.fine,
    summaryState.value === 'ready' ? receiptSummary.value : null,
    locale.value,
  )
})

async function loadSummary() {
  const targetFine = props.fine
  const uid = authStore.currentUser?.uid ?? ''
  if (!open.value || !targetFine || targetFine.status !== 'paid') {
    return
  }

  const nonce = ++activeRequestNonce
  receiptSummary.value = null
  summaryState.value = 'loading'

  if (!uid) {
    summaryState.value = 'error'
    return
  }

  try {
    const result = await fetchReceiptSummary(targetFine.id, uid)
    if (!open.value || nonce !== activeRequestNonce) {
      return
    }
    if (result.status === 'ready') {
      receiptSummary.value = result.summary
      summaryState.value = 'ready'
    } else {
      summaryState.value = 'missing'
    }
  } catch {
    if (!open.value || nonce !== activeRequestNonce) {
      return
    }
    receiptSummary.value = null
    summaryState.value = 'error'
  }
}

watch(
  [open, () => props.fine?.id],
  ([isOpen, fineId]) => {
    if (isOpen && fineId) {
      void loadSummary()
    } else if (!fineId) {
      activeRequestNonce++
      receiptSummary.value = null
      summaryState.value = 'idle'
    }
  },
  { immediate: true },
)

async function handleDownloadPdf() {
  if (!viewModel.value || downloading.value || summaryState.value === 'loading' || !hasPaymentReference.value) {
    return
  }

  downloading.value = true
  try {
    const pdfMake = await loadPdfMake()
    await downloadReceiptPdf(pdfMake, viewModel.value)
  } catch (err) {
    console.error('Receipt PDF generation failed:', err)
    toast.add({
      title: t('owner.fines.receipt_modal.download_error_title'),
      description: t('owner.fines.receipt_modal.download_error_desc'),
      color: 'error',
    })
  } finally {
    downloading.value = false
  }
}

onBeforeUnmount(() => {
  activeRequestNonce++
  receiptSummary.value = null
  summaryState.value = 'idle'
})
</script>
