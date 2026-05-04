<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <AppHeader title="Police Dashboard" role="police" />

    <UTabs class="px-10" :items="items">
      <template #cars>
        <UContainer class="py-6 space-y-10">
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

            <div v-else-if="!carsStore.activationPendingCars.length" class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
              <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
              <p>No activation requests</p>
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

              <template #ownerId-cell="{ row }">
                <AtomsUserName :user="userStore.usersCache[row.original.ownerId]" />
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
                  <UButton size="xs" color="neutral" variant="soft" icon="lucide:eye"
                    @click="openReview(row.original, 'activation')">
                    Details
                  </UButton>
                  <UButton size="xs" color="success" :loading="carsStore.isLoading(`${row.original.id}-approve`)"
                    @click="carsStore.approveCar(row.original.id)">
                    Approve
                  </UButton>
                  <UButton size="xs" color="error" variant="soft"
                    :loading="carsStore.isLoading(`${row.original.id}-reject`)"
                    @click="openRejectModal(row.original.id)">
                    Reject
                  </UButton>
                </div>
              </template>
            </UTable>
          </section>

          <section class="mt-12">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold">
                Deletion Requests
              </h2>

              <UBadge v-if="!carsStore.pendingCarsLoading" color="error" variant="soft">
                {{ carsStore.deletionPendingCars.length }}
              </UBadge>
            </div>

            <LoadingSkeleton v-if="carsStore.pendingCarsLoading" :count="4" />

            <div v-else-if="!carsStore.deletionPendingCars.length" class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
              <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
              <p>No deletion requests</p>
            </div>

            <UTable v-else :data="carsStore.deletionPendingCars" :columns="deleteColumns">
              <template #plateNumber-cell="{ row }">
                <span class="font-mono font-bold text-amber-400">
                  {{ row.original.plateNumber }}
                </span>
              </template>

              <template #vehicle-cell="{ row }">
                {{ row.original.brand }} {{ row.original.model }}
              </template>

              <template #ownerId-cell="{ row }">
                <AtomsUserName :user="userStore.usersCache[row.original.ownerId]" />
              </template>

              <template #createdAt-cell="{ row }">
                <span class="text-sm text-slate-400">
                  {{ new Date(row.original.createdAt).toLocaleString() }}
                </span>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex gap-2">
                  <UButton size="xs" color="neutral" variant="soft" icon="lucide:eye"
                    @click="openReview(row.original, 'deletion')">
                    Details
                  </UButton>
                  <UButton size="xs" color="error" :loading="carsStore.isLoading(row.original.id)"
                    @click="carsStore.approveDeletion(row.original.id)">
                    Approve Deletion
                  </UButton>
                </div>
              </template>
            </UTable>
          </section>

          <UDivider class="my-10" />

          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold flex items-center gap-2">
                <UIcon name="lucide:arrow-right-left" class="w-6 h-6 text-primary" />
                Transfer Requests
              </h2>
              <UBadge v-if="!carsStore.pendingCarsLoading" color="primary" variant="soft">
                {{ carsStore.transferRequestedCars?.length ?? 0 }}
              </UBadge>
            </div>

            <LoadingSkeleton v-if="carsStore.pendingCarsLoading" :count="3" />

            <div v-else-if="!carsStore.transferRequestedCars?.length" class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
              <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
              <p>No pending transfer requests</p>
            </div>

            <UTable v-else :data="carsStore.transferRequestedCars" :columns="carColumns">
              <template #plateNumber-cell="{ row }">
                <span class="font-mono font-bold text-amber-400">
                  {{ row.original.plateNumber }}
                </span>
              </template>

              <template #vehicle-cell="{ row }">
                {{ row.original.brand }} {{ row.original.model }}
              </template>

              <template #ownerId-cell="{ row }">
                <AtomsUserName :user="userStore.usersCache[row.original.ownerId]" />
              </template>

              <template #status-cell="{ row }">
                <UBadge color="primary" variant="soft">
                  Transfer Requested
                </UBadge>
              </template>

              <template #createdAt-cell="{ row }">
                <span class="text-sm text-slate-400">
                  {{ new Date(row.original.createdAt).toLocaleString() }}
                </span>
              </template>

              <template #carteGriseUrl-cell="{ row }">
                <UButton v-if="row.original.transferCarteGriseUrl || row.original.carteGriseUrl" :to="row.original.transferCarteGriseUrl || row.original.carteGriseUrl" target="_blank" size="xs"
                  color="neutral" variant="soft" icon="lucide:external-link">
                  View Document
                </UButton>
                <span v-else class="text-slate-500 italic text-sm">No doc</span>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex gap-2">
                  <UButton size="xs" color="neutral" variant="soft" icon="lucide:eye"
                    @click="openReview(row.original, 'transfer')">
                    Details
                  </UButton>
                  <UButton size="xs" color="success" :loading="carsStore.isLoading(row.original.id + '-approve')"
                    @click="carsStore.approveTransfer(row.original.id)">
                    Approve
                  </UButton>
                  <UButton size="xs" color="error" variant="soft" :loading="carsStore.isLoading(row.original.id + '-reject')"
                    @click="openRejectModal(row.original.id, true)">
                    Reject
                  </UButton>
                </div>
              </template>
            </UTable>
          </section>
        </UContainer>
      </template>

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

          <div v-else-if="!reportsStore.pendingReports?.length" class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
            <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
            <p>No pending reports</p>
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
    <!-- REJECT CAR MODAL -->
    <UModal v-model:open="isRejectModalOpen" title="Reject Vehicle">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-slate-400">
            Please provide a reason for rejecting this vehicle. This will be sent to the user.
          </p>

          <UTextarea class="w-full" v-model="rejectionReason" placeholder="Rejection reason..." :rows="4" />

          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="isRejectModalOpen = false">
              Cancel
            </UButton>
            <UButton color="error"
              :loading="selectedCarIdForRejection ? carsStore.isLoading(`${selectedCarIdForRejection}-reject`) : false"
              :disabled="!rejectionReason.trim()" @click="submitReject">
              Confirm Rejection
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- REVIEW MODAL -->
    <OrganismsPoliceCarReviewModal
      v-model:open="isReviewModalOpen"
      :car="reviewCar"
      :mode="reviewMode"
      @approve="handleReviewApprove"
      @reject="handleReviewReject"
    />
  </div>
</template>

<script setup lang="ts">
import { carStatusMapper } from '~/stores/cars'
import type { Report } from '~/stores/reports'

const reportsStore = useReportsStore()
const carsStore = useCarsStore()
const finesStore = useFinesStore()
const userStore = useUserStore()

watch(() => carsStore.activationPendingCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

watch(() => carsStore.deletionPendingCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

watch(() => carsStore.transferRequestedCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

const selected = ref<(Report & { id: string }) | null>(null)

const isDetailOpen = ref(false)
const isFineOpen = ref(false)

const isRejectModalOpen = ref(false)
const selectedCarIdForRejection = ref<string | null>(null)
const rejectionReason = ref('')
const isRejectingTransfer = ref(false)

// Review modal
const isReviewModalOpen = ref(false)
const reviewCar = ref<any | null>(null)
const reviewMode = ref<'activation' | 'deletion' | 'transfer'>('activation')

function openReview(car: any, mode: 'activation' | 'deletion' | 'transfer') {
  // Ensure owner(s) are pre-fetched for the modal
  userStore.fetchUser(car.ownerId)
  if (car.transferToOwnerId) userStore.fetchUser(car.transferToOwnerId)
  reviewCar.value = car
  reviewMode.value = mode
  isReviewModalOpen.value = true
}

function handleReviewApprove() {
  if (!reviewCar.value) return
  if (reviewMode.value === 'activation') carsStore.approveCar(reviewCar.value.id)
  else if (reviewMode.value === 'deletion') carsStore.approveDeletion(reviewCar.value.id)
  else if (reviewMode.value === 'transfer') carsStore.approveTransfer(reviewCar.value.id)
  isReviewModalOpen.value = false
}

function handleReviewReject() {
  if (!reviewCar.value) return
  isReviewModalOpen.value = false
  openRejectModal(reviewCar.value.id, reviewMode.value === 'transfer')
}

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

function openRejectModal(carId: string, isTransfer = false) {
  selectedCarIdForRejection.value = carId
  isRejectingTransfer.value = isTransfer
  rejectionReason.value = ''
  isRejectModalOpen.value = true
}

async function submitReject() {
  if (!selectedCarIdForRejection.value || !rejectionReason.value.trim()) return

  if (isRejectingTransfer.value) {
    await carsStore.rejectTransfer(selectedCarIdForRejection.value, rejectionReason.value)
  } else {
    await carsStore.rejectCar(selectedCarIdForRejection.value, rejectionReason.value)
  }
  
  isRejectModalOpen.value = false
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