<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <AppHeader title="Police Dashboard" role="police" />

    <div class="px-10 py-6">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        size="xl"
        placeholder="Search by plate number or owner name..."
        class="max-w-md shadow-inner"
        :ui="{ base: 'bg-slate-900 border-slate-800 focus:ring-indigo-500' }"
      />
    </div>

    <UTabs class="px-10" :items="items" :ui="{ 
      list: 'bg-slate-900 border border-slate-800 p-1 mb-8',
      indicator: 'bg-indigo-600',
      trigger: 'font-bold uppercase tracking-widest text-xs py-3'
    }">
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

            <UTable v-else :data="filteredActivationPending" :columns="carColumns">
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

            <UTable v-else :data="filteredDeletionPending" :columns="deleteColumns">
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

            <UTable v-else :data="filteredTransferRequested" :columns="carColumns">
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

      <template #reports>
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

          <UTable v-else :data="filteredPendingReports" :columns="columns">
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

      <template #audit>
        <UContainer class="py-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold">
              Fine Issuance Audit
            </h2>
          </div>

          <LoadingSkeleton v-if="finesStore.allFinesLoading" :count="8" />

          <div v-else-if="!finesStore.allFines?.length" class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
            <UIcon name="lucide:clipboard-list" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
            <p>No fines have been issued yet</p>
          </div>

          <UTable v-else :data="filteredAllFines" :columns="auditColumns">
            <template #plateNumber-cell="{ row }">
              <span class="font-mono font-bold text-amber-400">
                {{ row.original.plateNumber }}
              </span>
            </template>

            <template #ownerId-cell="{ row }">
              <AtomsUserName :user="userStore.usersCache[row.original.ownerId] || { name: row.original.ownerId }" />
            </template>

            <template #amount-cell="{ row }">
              <span class="font-bold text-white">TND {{ row.original.amount }}</span>
            </template>

            <template #status-cell="{ row }">
              <UBadge :color="row.original.status === 'paid' ? 'success' : 'error'" variant="subtle" size="xs" class="uppercase font-bold">
                {{ row.original.status }}
              </UBadge>
            </template>

            <template #issuedAt-cell="{ row }">
              <span class="text-sm text-slate-400">
                {{ new Date(row.original.issuedAt).toLocaleString() }}
              </span>
            </template>
          </UTable>
        </UContainer>
      </template>
    </UTabs>

    <!-- REPORT MODAL -->
    <UModal v-model:open="isDetailOpen" :title="`Report - ${selected?.plateNumber}`">
      <template #body>
        <div v-if="selected" class="space-y-4">
          <a v-if="selected.photoUrl" :href="selected.photoUrl" target="_blank" class="block group cursor-zoom-in relative">
            <img :src="selected.photoUrl" class="w-full rounded-xl transition-all duration-300 group-hover:brightness-75 group-hover:scale-[1.01]">
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <UIcon name="i-lucide-maximize-2" class="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          </a>

          <UButton block color="error" @click="openIssuePane">
            Issue Fine
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- FINE MODAL -->
    <UModal v-model:open="isFineOpen" title="Issue Fine" description="Create a new fine for a vehicle owner."
      :ui="{ 
        content: 'bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-2xl overflow-hidden',
        header: 'py-4 sm:py-5 border-b border-slate-800'
      }">
      <template #body>
        <div class="space-y-6">
          <div v-if="selected" class="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p class="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Vehicle Details</p>
            <div class="flex items-center gap-3">
              <span class="font-mono text-lg text-amber-400 font-bold">{{ selected.plateNumber }}</span>
              <span class="text-slate-300">{{ selected.address }}</span>
            </div>
          </div>

          <UFormField label="Vehicle Owner" :ui="{ label: { base: 'text-slate-300 font-medium text-sm mb-2' } }">
            <div v-if="fineForm.selectedOwner" class="flex items-center gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800 shadow-inner">
              <UAvatar :src="fineForm.selectedOwner.photoURL" :alt="fineForm.selectedOwner.fullName || fineForm.selectedOwner.name" size="lg" class="ring-2 ring-slate-800" />
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-bold text-white truncate">{{ fineForm.selectedOwner.fullName || fineForm.selectedOwner.name }}</span>
                <div class="flex items-center gap-2 mt-0.5">
                  <span v-if="fineForm.selectedOwner.identityNumber" class="text-[10px] text-indigo-400 font-mono tracking-tighter">{{ fineForm.selectedOwner.identityNumber }}</span>
                  <span v-if="fineForm.selectedOwner.email" class="text-[10px] text-slate-500 truncate">{{ fineForm.selectedOwner.email }}</span>
                </div>
              </div>
            </div>
            <div v-else-if="fineForm.searching" class="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center gap-3">
              <UIcon name="i-lucide-loader-2" class="w-5 h-5 text-indigo-500 animate-spin" />
              <span class="text-sm text-slate-400">Searching for owner...</span>
            </div>
            <div v-else class="p-4 bg-red-950/20 rounded-xl border border-red-900/50 flex flex-col items-center gap-2 text-center">
              <UIcon name="i-lucide-user-x" class="w-6 h-6 text-red-500" />
              <p class="text-sm text-red-400 font-medium">No registered owner found for this vehicle.</p>
              <p class="text-[10px] text-slate-500">The fine will be issued to the vehicle record if possible, or manual lookup required.</p>
            </div>
          </UFormField>

          <UFormField label="Fine Amount (TND)" required :ui="{ label: { base: 'text-slate-300 font-medium text-sm mb-2' } }">
            <UInput 
              v-model.number="fineForm.amount" 
              type="number" 
              size="xl"
              class="w-full"
              icon="i-lucide-circle-dollar-sign"
              :ui="{ base: 'bg-slate-950 border-slate-700 focus:ring-red-500 shadow-inner font-mono font-bold text-red-400' }" 
            />
          </UFormField>

          <UFormField label="Police Notes" :ui="{ label: { base: 'text-slate-300 font-medium text-sm mb-2' } }">
            <UTextarea 
              v-model="fineForm.notes" 
              placeholder="Reason for fine, evidence details..." 
              :rows="3"
              size="xl"
              class="w-full"
              :ui="{ base: 'bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner' }"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex flex-col sm:flex-row justify-center w-full gap-3 pt-2">
          <UButton label="Cancel" color="neutral" variant="soft" size="xl"
            class="flex-1 sm:flex-none justify-center font-semibold" @click="isFineOpen = false" :disabled="finesStore.acting" />
          <UButton label="Confirm Fine" color="error" size="xl"
            class="flex-1 sm:flex-none justify-center font-bold shadow-lg shadow-red-500/25" 
            :loading="finesStore.acting"
            :disabled="!fineForm.selectedOwner || !fineForm.amount || fineForm.searching" @click="submitFine" />
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

const searchQuery = ref('')

function filterList<T extends { plateNumber?: string, ownerId?: string }>(list: T[] | null) {
  if (!list) return []
  if (!searchQuery.value.trim()) return list

  const q = searchQuery.value.toLowerCase()
  return list.filter(item => {
    const plateMatch = item.plateNumber?.toLowerCase().includes(q)
    const owner = item.ownerId ? userStore.usersCache[item.ownerId] : null
    const ownerMatch = owner?.fullName?.toLowerCase().includes(q) || owner?.name?.toLowerCase().includes(q)
    return plateMatch || ownerMatch
  })
}

const filteredActivationPending = computed(() => filterList(carsStore.activationPendingCars))
const filteredDeletionPending = computed(() => filterList(carsStore.deletionPendingCars))
const filteredTransferRequested = computed(() => filterList(carsStore.transferRequestedCars))
const filteredPendingReports = computed(() => filterList(reportsStore.pendingReports))
const filteredAllFines = computed(() => filterList(finesStore.allFines))

watch(() => carsStore.activationPendingCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

watch(() => carsStore.deletionPendingCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

watch(() => carsStore.transferRequestedCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

watch(() => finesStore.allFines, (fines) => {
  if (!fines) return
  fines.forEach(fine => userStore.fetchUser(fine.ownerId))
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
  selectedOwner: null as any,
  searching: false,
  amount: 100,
  notes: ''
})

const items = computed(() => [
  {
    label: 'CARS',
    icon: 'i-lucide-car-front',
    slot: 'cars',
    badge: filteredActivationPending.value.length + 
           filteredDeletionPending.value.length + 
           filteredTransferRequested.value.length
  },
  {
    label: 'REPORTS',
    icon: 'i-lucide-camera',
    slot: 'reports',
    badge: filteredPendingReports.value.length
  },
  {
    label: 'AUDIT',
    icon: 'i-lucide-history',
    slot: 'audit',
    badge: filteredAllFines.value.length
  }
])

function openReport(report: Report & { id: string }) {
  selected.value = report
  isDetailOpen.value = true
}

async function openIssuePane() {
  if (!selected.value) return
  
  fineForm.selectedOwner = null
  fineForm.searching = true
  fineForm.amount = 100
  fineForm.notes = ''
  isFineOpen.value = true

  try {
    const car = await carsStore.getCarByPlate(selected.value.plateNumber)
    if (car && car.ownerId) {
      fineForm.selectedOwner = await userStore.fetchUser(car.ownerId)
    }
  } catch (e) {
    console.error('Failed to lookup owner:', e)
  } finally {
    fineForm.searching = false
  }
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
  if (!selected.value || !fineForm.selectedOwner) return

  await finesStore.issueFine({
    reportId: selected.value.id,
    ownerId: fineForm.selectedOwner.id,
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

const auditColumns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'ownerId', header: 'Owner' },
  { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'issuedAt', header: 'Date Issued' }
]
</script>

<style scoped>
:deep(th) {
  color: white !important;
}
</style>