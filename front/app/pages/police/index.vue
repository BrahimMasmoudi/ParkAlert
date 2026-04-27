<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <AppHeader title="Police Dashboard" role="police" />

    <UTabs class="px-10" :items="items">
      <!-- ========================================================= -->
      <!-- CARS -->
      <!-- ========================================================= -->
      <template #cars>
        <UContainer class="py-6 space-y-10">
          <!-- ACTIVATION REQUESTS -->
          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold">
                Pending Activations
              </h2>

              <UBadge v-if="!carsStore.pendingCarsLoading" color="warning" variant="soft">
                {{ carsStore.activationPendingCars.length }}
              </UBadge>
            </div>

            <LoadingSkeleton v-if="carsStore.pendingCarsLoading" :count="4" />

            <div v-else-if="!carsStore.activationPendingCars.length" class="text-center py-10 text-slate-500">
              No activation requests
            </div>

            <UTable v-else :data="carsStore.activationPendingCars" :columns="carColumns">
              <template #plateNumber-cell="{ row }">
                <span class="font-mono font-bold text-amber-400">
                  {{ row.original.plateNumber }}
                </span>
              </template>

              <template #vehicle-cell="{ row }">
                {{ row.original.brand }} {{ row.original.model }}
              </template>

              <template #status-cell="{ row }">
                <UBadge color="warning" variant="soft">
                  {{ carStatusMapper[row.original.status] }}
                </UBadge>
              </template>

              <template #createdAt-cell="{ row }">
                <span class="text-sm text-slate-400">
                  {{ new Date(row.original.createdAt).toLocaleString() }}
                </span>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex gap-2">
                  <UButton size="xs" color="success" :loading="carsStore.isLoading(row.original.id)"
                    @click="carsStore.approveCar(row.original.id)">
                    Approve
                  </UButton>

                  <UButton size="xs" color="error" variant="soft" :loading="carsStore.isLoading(row.original.id)"
                    @click="carsStore.rejectCar(row.original.id)">
                    Reject
                  </UButton>
                </div>
              </template>
            </UTable>
          </section>
        </UContainer>
      </template>

      <!-- ========================================================= -->
      <!-- FINES -->
      <!-- ========================================================= -->
      <template #fines>
        <UContainer class="py-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold">
              Pending Reports
            </h2>

            <UBadge v-if="!reportsStore.reportsLoading" color="warning" variant="soft">
              {{ reportsStore.pendingReports?.length ?? 0 }}
            </UBadge>
          </div>

          <LoadingSkeleton v-if="reportsStore.reportsLoading" :count="5" />

          <div v-else-if="!reportsStore.pendingReports?.length" class="text-center py-16 text-slate-500">
            No pending reports
          </div>

          <UTable v-else :data="reportsStore.pendingReports" :columns="columns">
            <template #plateNumber-cell="{ row }">
              <span class="font-mono font-bold text-amber-400">
                {{ row.original.plateNumber }}
              </span>
            </template>

            <template #status-cell="{ row }">
              <UBadge color="warning" variant="soft">
                {{ row.original.status }}
              </UBadge>
            </template>

            <template #timestamp-cell="{ row }">
              <span class="text-sm text-slate-400">
                {{ new Date(row.original.timestamp).toLocaleString() }}
              </span>
            </template>

            <template #actions-cell="{ row }">
              <UButton variant="ghost" icon="i-lucide-eye" @click="openReport(row.original)" />
            </template>
          </UTable>
        </UContainer>
      </template>
    </UTabs>

    <!-- REPORT MODAL -->
    <UModal v-model:open="isDetailOpen" :title="`Report - ${selected?.plateNumber}`">
      <template #body>
        <div v-if="selected" class="space-y-4">
          <img v-if="selected.photoUrl" :src="selected.photoUrl" class="w-full rounded-xl">

          <UButton block color="error" @click="openIssuePane">
            Issue Fine
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- FINE MODAL -->
    <UModal v-model:open="isFineOpen" title="Issue Fine">
      <template #body>
        <div class="space-y-4">
          <UInput v-model="fineForm.ownerId" placeholder="Owner UID" />

          <UInput v-model.number="fineForm.amount" type="number" />

          <UTextarea v-model="fineForm.notes" placeholder="Notes" />

          <UButton block color="error" @click="submitFine">
            Confirm Fine
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { carStatusMapper } from '~/stores/cars'
import type { Report } from '~/stores/reports'

const reportsStore = useReportsStore()
const carsStore = useCarsStore()
const finesStore = useFinesStore()

const selected = ref<(Report & { id: string }) | null>(null)

const isDetailOpen = ref(false)
const isFineOpen = ref(false)

const fineForm = reactive({
  ownerId: '',
  amount: 100,
  notes: ''
})

const items = [
  {
    label: 'CARS',
    icon: 'i-lucide-car-front',
    slot: 'cars'
  },
  {
    label: 'FINES',
    icon: 'i-lucide-circle-dollar-sign',
    slot: 'fines'
  }
]

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
  if (!selected.value) return

  await finesStore.issueFine({
    reportId: selected.value.id,
    ownerId: fineForm.ownerId,
    plateNumber: selected.value.plateNumber,
    amount: fineForm.amount,
    notes: fineForm.notes
  })

  isFineOpen.value = false
  isDetailOpen.value = false
}

const carColumns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'vehicle', header: 'Vehicle' },
  { accessorKey: 'ownerId', header: 'Owner' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'createdAt', header: 'Created' },
  { id: 'actions', header: 'Actions' }
]

const deleteColumns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'vehicle', header: 'Vehicle' },
  { accessorKey: 'ownerId', header: 'Owner' },
  { accessorKey: 'createdAt', header: 'Requested' },
  { id: 'actions', header: 'Actions' }
]

const columns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'address', header: 'Location' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'timestamp', header: 'Time' },
  { id: 'actions', header: 'Actions' }
]
</script>

<style scoped>
:deep(th) {
  color: white !important;
}
</style>