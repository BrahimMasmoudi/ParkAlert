<template>
  <UContainer>
    <div class="grid grid-cols-2 gap-3 mb-6">
      <UCard class="bg-amber-500/10 border border-amber-500/25 text-center p-4">
        <p class="text-3xl font-bold text-amber-700 dark:text-amber-400">
          {{ reportsStore.agentReportsTodayCount }}
        </p>
        <p class="text-muted text-xs mt-1">
          {{ $t('agent.reports_today') }}
        </p>
      </UCard>
      <UCard class="bg-elevated border border-default text-center p-4">
        <p class="text-3xl font-bold text-highlighted">
          {{ reportsStore.agentTotalReportsCount }}
        </p>
        <p class="text-muted text-xs mt-1">
          {{ $t('agent.total_reports') }}
        </p>
      </UCard>
    </div>

    <button
      id="new-report-btn"
      class="w-full bg-amber-700 hover:bg-amber-600 active:scale-95 text-white rounded-3xl py-8 flex flex-col items-center gap-3 shadow-xl transition-all duration-200 mb-6"
      @click="isOpen = true"
    >
      <UIcon name="lucide:camera" class="w-12 h-12" />
      <span class="text-xl font-bold tracking-tight">{{ $t('agent.new_report') }}</span>
      <span class="text-amber-100 text-sm">{{ $t('agent.new_report_subtitle') }}</span>
    </button>

    <div class="space-y-3 mb-6">
      <h2 class="text-sm font-bold uppercase tracking-wider text-muted">
        {{ $t('agent.sent_reports') }}
      </h2>

      <div v-if="reportsStore.agentReportsLoading" class="text-center py-6 text-muted text-sm">
        {{ $t('common.loading') }}
      </div>

      <div
        v-else-if="sortedAgentReports.length === 0"
        class="bg-elevated border border-default rounded-2xl p-6 text-center text-muted text-sm"
      >
        {{ $t('agent.no_reports') }}
      </div>

      <div
        v-for="report in sortedAgentReports"
        :key="report.id"
        class="bg-elevated border border-default rounded-2xl p-4 flex items-center justify-between gap-3"
      >
        <div class="min-w-0 space-y-1">
          <div class="flex items-center gap-2">
            <span dir="ltr" class="font-mono font-bold text-highlighted tracking-wider">{{ report.plateNumber }}</span>
            <UBadge :color="statusColor(report.status)" variant="subtle" size="xs">
              {{ $t(`agent.status.${report.status}`) }}
            </UBadge>
          </div>
          <p v-if="report.address" class="text-xs text-muted truncate">{{ report.address }}</p>
          <p class="text-[11px] text-dimmed">{{ formatDate(report.timestamp) }}</p>
        </div>

        <UButton
          v-if="report.status === 'pending'"
          size="sm"
          color="warning"
          variant="soft"
          icon="i-lucide-pencil"
          :label="$t('agent.edit_plate.button')"
          @click="openEditModal(report)"
        />
      </div>
    </div>

    <p class="text-muted text-sm text-center">
      {{ $t('agent.footer_info') }}
    </p>

    <OrganismsAgentNewReportModal v-model:open="isOpen" />

    <UModal
      v-model:open="isEditOpen"
      :title="$t('agent.edit_plate.title')"
      :ui="{
        content: 'max-w-2xl sm:min-h-[34rem]',
        body: 'p-5 sm:p-6'
      }"
    >
      <template #body>
        <div v-if="editingReport" class="space-y-4">
          <MoleculesEvidenceGallery
            :items="evidenceItems"
            :loading="loadingEvidence"
            :title="$t('agent.edit_plate.photos_label')"
            :empty-message="$t('police.review.no_evidence')"
            @refresh="loadEditingEvidence"
          />

          <UFormField :label="$t('agent.edit_plate.plate_label')">
            <UInput
              v-model="editedPlate"
              dir="ltr"
              size="xl"
              :placeholder="$t('agent.form.plate_placeholder')"
              class="font-mono text-xl uppercase tracking-widest"
            />
          </UFormField>
          <p v-if="editedPlate && !isEditedPlateValid" class="text-red-700 dark:text-red-400 text-xs">
            {{ $t('agent.form.invalid_plate') }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('common.cancel')"
            @click="isEditOpen = false"
          />
          <UButton
            color="warning"
            :loading="editingReport ? reportsStore.isActing(editingReport.id) : false"
            :disabled="!isEditedPlateValid"
            :label="$t('common.save')"
            @click="saveEditedPlate"
          />
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

<script setup lang="ts">
import type { EvidenceUrlItem } from '~/composables/useDocumentViewer'
import type { Report } from '~/stores/reports'

const { locale } = useI18n()

definePageMeta({
  ssr: false,
  title: 'agent.title',
  role: 'agent',
  containerClass: 'max-w-lg',
})

const reportsStore = useReportsStore()
const { fetchEvidenceUrls, loadingEvidence } = useDocumentViewer()
const { isFrenchPlateValid, formatFrenchPlate } = useVehicleValidation()

const isOpen = ref(false)
const isEditOpen = ref(false)
const editingReport = ref<Report | null>(null)
const editedPlate = ref('')
const evidenceItems = ref<EvidenceUrlItem[]>([])

const sortedAgentReports = computed(() =>
  [...(reportsStore.agentReports ?? [])].sort((a, b) => b.timestamp - a.timestamp),
)

const isEditedPlateValid = computed(() => isFrenchPlateValid(editedPlate.value.trim()))

watch(editedPlate, (val) => {
  if (val) editedPlate.value = formatFrenchPlate(val)
})

function statusColor(status: Report['status']) {
  if (status === 'pending') return 'warning'
  if (status === 'investigated') return 'info'
  return 'neutral'
}

function formatDate(ts: number) {
  if (!ts) return ''
  return new Date(ts).toLocaleString(locale.value)
}

async function loadEditingEvidence() {
  if (!editingReport.value) return
  try {
    evidenceItems.value = await fetchEvidenceUrls('report', editingReport.value.id)
  }
  catch {
    evidenceItems.value = []
  }
}

async function openEditModal(report: Report) {
  editingReport.value = report
  editedPlate.value = report.plateNumber
  evidenceItems.value = []
  isEditOpen.value = true
  await loadEditingEvidence()
}

async function saveEditedPlate() {
  if (!editingReport.value || !isEditedPlateValid.value) return
  await reportsStore.updatePendingReportPlate(editingReport.value.id, editedPlate.value.trim().toUpperCase())
  isEditOpen.value = false
  editingReport.value = null
}
</script>
