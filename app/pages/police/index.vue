<script setup lang="ts">
import type { Report } from '~/stores/reports'

const reportsStore = useReportsStore()
const finesStore = useFinesStore()

const selected = ref<(Report & { id: string }) | null>(null)
const isDetailOpen = ref(false)
const isFineOpen = ref(false)

const fineForm = reactive({
  ownerId: '',
  amount: 100,
  notes: '',
})

function openReport(report: Report & { id: string }) {
  selected.value = report
  isDetailOpen.value = true
}

function openIssuePane() {
  fineForm.ownerId = ''
  fineForm.amount = 100
  fineForm.notes = ''
  isFineOpen.value = true
}

async function submitFine() {
  if (!selected.value || !fineForm.ownerId) return
  await finesStore.issueFine({
    reportId: selected.value.id,
    ownerId: fineForm.ownerId,
    plateNumber: selected.value.plateNumber,
    amount: fineForm.amount,
    notes: fineForm.notes,
  })
  isFineOpen.value = false
  isDetailOpen.value = false
}

const columns = [
  { key: 'plateNumber', label: 'Plate' },
  { key: 'address', label: 'Location' },
  { key: 'timestamp', label: 'Time' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <AppHeader title="Police Dashboard" role="police" />

    <UContainer class="py-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">
          Pending Reports
        </h2>
        <UBadge v-if="!reportsStore.reportsLoading" color="warning" variant="soft">
          {{ reportsStore.pendingReports?.length ?? 0 }} open
        </UBadge>
      </div>

      <!-- Loading -->
      <LoadingSkeleton v-if="reportsStore.reportsLoading" :count="5" />

      <!-- Empty -->
      <div v-else-if="!reportsStore.pendingReports?.length" class="text-center py-16 text-slate-500">
        <UIcon name="lucide:check-circle-2" class="w-12 h-12 mx-auto mb-3 text-emerald-500/50" />
        <p>No pending reports — all clear!</p>
      </div>

      <!-- Table -->
      <UTable
        v-else
        :data="reportsStore.pendingReports"
        :columns="columns"
        class="bg-slate-900/60 border border-slate-800 rounded-2xl"
      >
        <template #plateNumber-cell="{ row }">
          <span class="font-mono font-bold tracking-wider text-amber-400">{{ row.plateNumber }}</span>
        </template>
        <template #timestamp-cell="{ row }">
          <span class="text-slate-400 text-sm">
            {{ row.timestamp?.toDate ? row.timestamp.toDate().toLocaleString() : '—' }}
          </span>
        </template>
        <template #actions-cell="{ row }">
          <UButton size="sm" variant="ghost" @click="openReport(row)">
            View
          </UButton>
        </template>
      </UTable>
    </UContainer>

    <!-- ── Report Detail Modal ──────────────────────────────────────────────── -->
    <UModal v-model:open="isDetailOpen" :title="`Report — ${selected?.plateNumber}`" :ui="{ content: 'bg-slate-900 border border-slate-700' }">
      <template #body>
        <div v-if="selected" class="space-y-4">
          <img
            v-if="selected.photoUrl"
            :src="selected.photoUrl"
            class="w-full aspect-video object-cover rounded-xl"
            alt="Report photo"
          >
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-slate-800 rounded-xl p-3">
              <p class="text-slate-400 text-xs">
                Plate
              </p>
              <p class="font-mono font-bold text-amber-400 text-lg">
                {{ selected.plateNumber }}
              </p>
            </div>
            <div class="bg-slate-800 rounded-xl p-3">
              <p class="text-slate-400 text-xs">
                Status
              </p>
              <p class="capitalize font-semibold text-white">
                {{ selected.status }}
              </p>
            </div>
            <div class="bg-slate-800 rounded-xl p-3 col-span-2">
              <p class="text-slate-400 text-xs">
                Location
              </p>
              <p class="text-white">
                {{ selected.address || `${selected.location?.lat}, ${selected.location?.lng}` }}
              </p>
            </div>
          </div>
          <UButton
            id="issue-fine-open-btn"
            block
            size="lg"
            class="bg-red-600 hover:bg-red-500 text-white font-semibold"
            @click="openIssuePane"
          >
            <UIcon name="lucide:gavel" class="w-5 h-5 mr-2" />
            Issue Fine
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── Issue Fine Modal ────────────────────────────────────────────────── -->
    <UModal v-model:open="isFineOpen" title="Issue Fine" :ui="{ content: 'bg-slate-900 border border-slate-700' }">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Owner UID or Plate Lookup" name="ownerId" required>
            <UInput
              id="owner-id-input"
              v-model="fineForm.ownerId"
              placeholder="Enter the owner's UID"
              size="lg"
            />
          </UFormField>
          <UFormField label="Fine Amount (€)" name="amount" required>
            <UInput
              id="fine-amount-input"
              v-model.number="fineForm.amount"
              type="number"
              min="10"
              max="10000"
              size="lg"
            />
          </UFormField>
          <UFormField label="Notes (optional)" name="notes">
            <UTextarea
              id="fine-notes-input"
              v-model="fineForm.notes"
              placeholder="Additional context..."
              rows="3"
            />
          </UFormField>
          <UButton
            id="confirm-fine-btn"
            block
            size="lg"
            :loading="finesStore.acting"
            :disabled="!fineForm.ownerId"
            class="bg-red-600 hover:bg-red-500 text-white font-semibold"
            @click="submitFine"
          >
            Confirm & Issue Fine
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
