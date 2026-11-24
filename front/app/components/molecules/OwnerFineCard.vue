<template>
  <div class="bg-elevated border border-default rounded-2xl overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-xl group">
    <div class="p-5 flex items-start justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="p-3 rounded-xl bg-default border border-default group-hover:bg-muted transition-colors">
          <UIcon
            :name="statusIcon"
            class="w-6 h-6"
            :class="statusIconClass"
          />
        </div>
        <div>
          <h3 dir="ltr" class="text-lg font-bold text-highlighted tracking-tight">{{ fine.plateNumber }}</h3>
          <p class="text-xs text-dimmed font-mono tracking-widest uppercase mt-0.5">
            {{ $t('owner.fines.reference') }}: #{{ fine.id.slice(-6).toUpperCase() }}
          </p>
        </div>
      </div>

      <div class="text-end space-y-1.5">
        <p dir="ltr" class="text-2xl font-black text-highlighted leading-none">TND {{ fine.amount }}</p>
        <div class="flex items-center justify-end gap-1.5 flex-wrap">
          <UBadge
            :color="statusBadgeColor"
            variant="subtle"
            size="xs"
            class="font-bold uppercase tracking-wider px-2 py-0.5"
          >
            {{ $t(`police.audit.${fine.status}`) || fine.status }}
          </UBadge>
          <UBadge
            v-if="fine.disputeStatus && fine.disputeStatus !== 'none'"
            :color="disputeBadgeColor"
            variant="soft"
            size="xs"
            class="font-bold uppercase tracking-wider px-2 py-0.5"
          >
            {{ disputeBadgeLabel }}
          </UBadge>
        </div>
      </div>
    </div>

    <div v-if="fine.notes || fine.disputeReason || fine.resolutionReason" class="px-5 pb-4 space-y-2">
      <div v-if="fine.notes" class="bg-default border border-default rounded-lg p-3">
        <p class="text-[11px] text-muted italic leading-relaxed">"{{ fine.notes }}"</p>
      </div>
      <div
        v-if="fine.disputeReason"
        class="bg-default border border-amber-500/25 rounded-lg p-3 text-xs text-default"
      >
        <span class="font-bold uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-400 block mb-1">
          {{ $t('owner.fines.dispute_reason_label') }}
        </span>
        {{ fine.disputeReason }}
      </div>
      <div
        v-if="fine.resolutionReason"
        class="bg-default border border-default rounded-lg p-3 text-xs text-default"
      >
        <span class="font-bold uppercase tracking-wider text-[10px] text-muted block mb-1">
          {{ $t('owner.fines.resolution_reason_label') }}
        </span>
        {{ fine.resolutionReason }}
      </div>
    </div>

    <div class="px-5 py-3 bg-muted/40 border-t border-default flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-2 text-dimmed">
        <UIcon name="i-lucide-calendar" class="w-4 h-4" />
        <span class="text-[10px] font-medium">{{ formatDate(fine.issuedAt) }}</span>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <UButton
          v-if="fine.status !== 'cancelled'"
          :label="$t('owner.fines.view_evidence')"
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-camera"
          @click="openEvidenceModal"
        />

        <UButton
          v-if="canDispute"
          :label="$t('owner.fines.dispute_button')"
          color="warning"
          variant="soft"
          size="sm"
          icon="i-lucide-message-square-warning"
          :loading="finesStore.acting"
          @click="openDisputeModal"
        />

        <UButton
          v-if="fine.status === 'unpaid' && fine.disputeStatus !== 'pending'"
          :label="$t('owner.fines.pay_button')"
          color="primary"
          size="sm"
          icon="i-lucide-credit-card"
          class="font-bold shadow-lg px-4"
          @click="emit('pay', fine)"
        />
        <span
          v-else-if="fine.status === 'unpaid' && fine.disputeStatus === 'pending'"
          class="text-amber-700 dark:text-amber-400 font-bold text-[10px] uppercase tracking-widest px-2"
        >
          {{ $t('owner.fines.under_review') }}
        </span>
        <UButton
          v-else-if="fine.status === 'paid'"
          :label="$t('owner.fines.receipt_modal.open_button')"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-file-text"
          @click="emit('receipt', fine)"
        />
        <div
          v-else
          class="flex items-center gap-1.5 text-muted font-bold text-[10px] uppercase tracking-widest"
        >
          <UIcon name="i-lucide-ban" class="w-3.5 h-3.5" />
          {{ $t('police.audit.cancelled') }}
        </div>
      </div>
    </div>

    <UModal
      v-model:open="isEvidenceOpen"
      :title="`${$t('owner.fines.evidence_modal_title')} - ${fine.plateNumber}`"
      :ui="{
        content: 'max-w-2xl sm:min-h-[34rem]',
        body: 'p-5 sm:p-6',
      }"
    >
      <template #body>
        <MoleculesEvidenceGallery
          :items="evidenceItems"
          :loading="loadingEvidence"
          :empty-message="$t('owner.fines.no_evidence_legacy')"
          @refresh="loadEvidence"
        />
      </template>
      <template #footer>
        <div class="flex justify-end w-full">
          <UButton
            :label="$t('common.close')"
            color="neutral"
            variant="ghost"
            @click="isEvidenceOpen = false"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isDisputeOpen"
      :title="$t('owner.fines.dispute_modal_title')"
      :description="$t('owner.fines.dispute_modal_description')"
    >
      <template #body>
        <div class="space-y-3">
          <UTextarea
            v-model="disputeReason"
            :placeholder="$t('owner.fines.dispute_placeholder')"
            :rows="4"
            class="w-full"
          />
          <p v-if="disputeReasonError" class="text-xs text-red-700 dark:text-red-400">
            {{ disputeReasonError }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end w-full">
          <UButton
            :label="$t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="isDisputeOpen = false"
          />
          <UButton
            :label="$t('owner.fines.submit_dispute')"
            color="warning"
            :loading="finesStore.acting"
            :disabled="Boolean(disputeReasonError)"
            @click="submitDispute"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { EvidenceUrlItem } from '~/composables/useDocumentViewer'
import type { Fine } from '~/stores/fines'

const props = defineProps<{
  fine: Fine
}>()

const emit = defineEmits<{
  (e: 'pay', fine: Fine): void
  (e: 'receipt', fine: Fine): void
}>()

const { locale, t } = useI18n()
const finesStore = useFinesStore()
const { fetchEvidenceUrls, loadingEvidence } = useDocumentViewer()

const isEvidenceOpen = ref(false)
const evidenceItems = ref<EvidenceUrlItem[]>([])
const isDisputeOpen = ref(false)
const disputeReason = ref('')

const canDispute = computed(
  () => props.fine.status === 'unpaid' && (props.fine.disputeStatus ?? 'none') === 'none',
)

const statusIcon = computed(() => {
  if (props.fine.status === 'paid') return 'i-lucide-check-circle'
  if (props.fine.status === 'cancelled') return 'i-lucide-ban'
  return 'i-lucide-alert-triangle'
})

const statusIconClass = computed(() => {
  if (props.fine.status === 'paid') return 'text-emerald-700 dark:text-emerald-400'
  if (props.fine.status === 'cancelled') return 'text-muted'
  return 'text-red-700 dark:text-red-400'
})

const statusBadgeColor = computed(() => {
  if (props.fine.status === 'paid') return 'success'
  if (props.fine.status === 'cancelled') return 'neutral'
  return 'error'
})

const disputeBadgeColor = computed(() => {
  if (props.fine.disputeStatus === 'pending') return 'warning'
  if (props.fine.disputeStatus === 'rejected') return 'error'
  return 'neutral'
})

const disputeBadgeLabel = computed(() => {
  if (props.fine.disputeStatus === 'pending') return t('owner.fines.dispute_pending_badge')
  if (props.fine.disputeStatus === 'rejected') return t('owner.fines.dispute_rejected_badge')
  if (props.fine.disputeStatus === 'accepted') return t('owner.fines.dispute_accepted_badge')
  return ''
})

const disputeReasonError = computed(() => {
  const len = disputeReason.value.trim().length
  if (len < 3 || len > 500) {
    return t('owner.fines.dispute_reason_length_error')
  }
  return ''
})

async function loadEvidence() {
  try {
    evidenceItems.value = await fetchEvidenceUrls('fine', props.fine.id)
  }
  catch {
    evidenceItems.value = []
  }
}

async function openEvidenceModal() {
  evidenceItems.value = []
  isEvidenceOpen.value = true
  await loadEvidence()
}

function openDisputeModal() {
  disputeReason.value = ''
  isDisputeOpen.value = true
}

async function submitDispute() {
  if (disputeReasonError.value) return
  await finesStore.disputeFine(props.fine.id, disputeReason.value.trim())
  isDisputeOpen.value = false
}

function formatDate(timestamp: number) {
  if (!timestamp) return t('owner.fines.unknown_date')
  return new Date(timestamp).toLocaleDateString(locale.value || 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>
