<template>
  <UModal
    v-model:open="open"
    :title="$t('police.audit.receipt_modal_title')"
    :description="$t('police.audit.receipt_modal_desc')"
    :ui="{
      content: 'max-w-xl no-print-modal',
      body: 'p-4 sm:p-6 space-y-4',
    }"
  >
    <template #body>
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-shield-check"
        :description="$t('police.audit.verification_only_notice')"
      />

      <UAlert
        v-if="locale === 'ar'"
        color="neutral"
        variant="subtle"
        icon="i-lucide-languages"
        :description="$t('owner.fines.receipt_modal.arabic_fallback_notice')"
      />

      <MoleculesFineReceiptCard
        v-if="viewModel"
        :view-model="viewModel"
        :copy="viewModel.copy"
      />
    </template>

    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          :label="$t('common.close')"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Fine } from '~/stores/fines'
import { buildReceiptViewModel } from '~/utils/receiptPdf'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  fine: Fine | null
}>()

const { locale } = useI18n()

// Strictly built from Fine metadata only — never fetches receipt/summary or exposes card PII.
const viewModel = computed(() => {
  if (!props.fine) return null
  return buildReceiptViewModel(props.fine, null, locale.value)
})
</script>
