<template>
  <UContainer>
    <div class="grid grid-cols-2 gap-3 mb-6">
      <UCard class="bg-amber-500/10 border border-amber-500/20 text-center p-4">
        <p class="text-3xl font-bold text-amber-400">
          {{ reportsStore.agentReportsTodayCount }}
        </p>
        <p class="text-slate-400 text-xs mt-1">
          {{ $t('agent.reports_today') }}
        </p>
      </UCard>
      <UCard class="bg-slate-800/60 border border-slate-700/50 text-center p-4">
        <p class="text-3xl font-bold text-white">
          {{ reportsStore.agentTotalReportsCount }}
        </p>
        <p class="text-slate-400 text-xs mt-1">
          {{ $t('agent.total_reports') }}
        </p>
      </UCard>
    </div>

    <button
      id="new-report-btn"
      class="w-full bg-gradient-to-br from-amber-500 to-orange-600 hover:brightness-110 active:scale-95 text-white rounded-3xl py-8 flex flex-col items-center gap-3 shadow-2xl shadow-amber-600/30 transition-all duration-200 mb-6"
      @click="isOpen = true"
    >
      <UIcon name="lucide:camera" class="w-12 h-12" />
      <span class="text-xl font-bold tracking-tight">{{ $t('agent.new_report') }}</span>
      <span class="text-amber-200 text-sm">{{ $t('agent.new_report_subtitle') }}</span>
    </button>

    <div class="space-y-3 mb-6">
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400">
        {{ $t('agent.sent_reports') }}
      </h2>

      <div v-if="reportsStore.agentReportsLoading" class="text-center py-6 text-slate-500 text-sm">
        {{ $t('common.loading') }}
      </div>

      <div
        v-else-if="sortedAgentReports.length === 0"
        class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-sm"
      >
        {{ $t('agent.no_reports') }}
      </div>

      <div
        v-for="report in sortedAgentReports"
        :key="report.id"
        class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
      >
        <div class="min-w-0 space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-white tracking-wider">{{ report.plateNumber }}</span>
            <UBadge :color="statusColor(report.status)" variant="subtle" size="xs">
              {{ $t(`agent.status.${report.status}`) }}
            </UBadge>
          </div>
          <p v-if="report.address" class="text-xs text-slate-400 truncate">{{ report.address }}</p>
          <p class="text-[11px] text-slate-500">{{ formatDate(report.timestamp) }}</p>
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

    <p class="text-slate-500 text-sm text-center">
      {{ $t('agent.footer_info') }}
    </p>

    <OrganismsAgentNewReportModal v-model:open="isOpen" />

    <UModal
      v-model:open="isEditOpen"
      :title="$t('agent.edit_plate.title')"
      :ui="{ content: 'bg-slate-900 border border-slate-700' }"
    >
      <template #body>
        <div v-if="editingReport" class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {{ $t('agent.edit_plate.photos_label') }}
            </span>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-refresh-cw"
              :loading="loadingEvidence"
              :label="$t('common.refresh_photos')"
              @click="loadEditingEvidence"
            />
          </div>

          <div v-if="loadingEvidence" class="py-6 flex justify-center text-slate-400">
            <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin" />
          </div>

          <div v-else-if="evidenceItems.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="item in evidenceItems"
              :key="item.slot"
              class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden"
            >
              <div class="px-2.5 py-1 bg-slate-900 text-[11px] font-semibold text-slate-300">
                {{ slotTitle(item.slot) }}
              </div>
              <img
                v-if="item.url && !brokenSlots[item.slot]"
                :src="item.url"
                class="w-full h-36 object-cover"
                :alt="slotTitle(item.slot)"
                @error="brokenSlots[item.slot] = true"
              >
              <div v-else class="h-36 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-slate-400">
                <span>{{ $t('common.photo_unavailable') }}</span>
                <UButton
                  size="xs"
                  variant="soft"
                  color="warning"
                  :label="$t('common.refresh_photos')"
                  @click="loadEditingEvidence"
                />
              </div>
            </div>
          </div>

          <UFormField :label="$t('agent.edit_plate.plate_label')">
            <UInput
              v-model="editedPlate"
              size="xl"
              :placeholder="$t('agent.form.plate_placeholder')"
              class="font-mono text-xl uppercase tracking-widest"
            />
          </UFormField>
          <p v-if="editedPlate && !isEditedPlateValid" class="text-red-400 text-xs">
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
import type { Report, ReportPhotoSlot } from '~/stores/reports'

const { t, locale } = useI18n()

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
const brokenSlots = ref<Record<string, boolean>>({})

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

function slotTitle(slot: ReportPhotoSlot) {
  if (slot === 'context') return t('agent.form.slot_context_label')
  if (slot === 'plate') return t('agent.form.slot_plate_label')
  return t('agent.form.slot_extra_label')
}

function formatDate(ts: number) {
  if (!ts) return ''
  return new Date(ts).toLocaleString(locale.value)
}

async function loadEditingEvidence() {
  if (!editingReport.value) return
  brokenSlots.value = {}
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
