<template>
  <MoleculesPoliceSearchBar v-model="searchQuery" />

  <UTabs :items="tabs" :ui="{
    list: 'bg-slate-900 border border-slate-800 p-1 mb-8',
    indicator: 'bg-indigo-600',
    trigger: 'font-bold uppercase tracking-widest text-xs py-3'
  }">
    <template #cars>
      <OrganismsPoliceCarsTab :activations="filteredActivationPending" :deletions="filteredDeletionPending"
        :transfers="filteredTransferRequested" :loading="carsStore.pendingCarsLoading" :car-columns="carColumns"
        :delete-columns="deleteColumns" @review="openReview" @reject="openRejectModal" />
    </template>

    <template #reports>
      <OrganismsPoliceReportsTab :reports="filteredPendingReports" :loading="reportsStore.reportsLoading"
        :columns="columns" @open="openReport" />
    </template>

    <template #audit>
      <OrganismsPoliceAuditTab :fines="filteredAllFines" :loading="finesStore.allFinesLoading"
        :columns="auditColumns" />
    </template>
  </UTabs>

  <UModal v-model:open="isDetailOpen" :title="`${$t('agent.new_report')} - ${selected?.plateNumber}`">
    <template #body>
      <div v-if="selected" class="space-y-4">
        <a v-if="selected.photoUrl" :href="selected.photoUrl" target="_blank"
          class="block group cursor-zoom-in relative">
          <img :src="selected.photoUrl"
            class="w-full rounded-xl transition-all duration-300 group-hover:brightness-75 group-hover:scale-[1.01]">
          <div
            class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <UIcon name="i-lucide-maximize-2" class="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </a>

        <UButton block color="error" @click="openIssuePane">
          {{ $t('police.actions.issue_fine') }}
        </UButton>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="isFineOpen" :title="$t('police.fine.title')" :description="$t('police.fine.description')" :ui="{
    content: 'bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-2xl overflow-hidden',
    header: 'py-4 sm:py-5 border-b border-slate-800'
  }">
    <template #body>
      <div class="space-y-6">
        <div v-if="selected" class="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <UIcon name="i-lucide-car" class="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">{{ $t('police.fine.target_vehicle')
              }}</p>
              <p class="font-mono text-xl font-black text-white tracking-widest">{{ selected.plateNumber }}</p>
            </div>
          </div>

          <div v-if="fineForm.searching" class="mt-4 flex items-center gap-2 text-slate-400 text-sm italic">
            <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
            {{ $t('police.fine.searching_owner') }}
          </div>

          <div v-else-if="fineForm.selectedOwner"
            class="mt-4 pt-4 border-t border-slate-800/50 flex items-center gap-3">
            <UAvatar :src="fineForm.selectedOwner.photoURL"
              :alt="fineForm.selectedOwner.fullName || fineForm.selectedOwner.name" size="sm" />
            <div class="min-w-0">
              <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">{{ $t('police.fine.owner_found') }}
              </p>
              <p class="text-sm font-bold text-white truncate">{{ fineForm.selectedOwner.fullName ||
                fineForm.selectedOwner.name }}</p>
              <p class="text-[10px] text-indigo-400 font-mono">{{ fineForm.selectedOwner.identityNumber }}</p>
            </div>
          </div>
          <div v-else
            class="mt-4 p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
            <UIcon name="lucide:alert-circle" class="w-4 h-4" />
            {{ $t('police.fine.no_owner_found') }}
          </div>
        </div>

        <UFormField :label="$t('police.fine.amount')">
          <UInput v-model="fineForm.amount" type="number" size="xl" icon="i-lucide-circle-dollar-sign" />
        </UFormField>

        <UFormField :label="$t('police.fine.notes')">
          <UTextarea v-model="fineForm.notes" :placeholder="$t('police.fine.notes_placeholder')" size="xl" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end w-full">
        <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="isFineOpen = false" />
        <UButton :label="$t('police.fine.confirm')" color="error" icon="i-lucide-check-circle"
          class="font-bold px-6 shadow-lg shadow-red-500/20" :loading="finesStore.acting"
          :disabled="!fineForm.selectedOwner" @click="confirmFine" />
      </div>
    </template>
  </UModal>

  <UModal v-model:open="isRejectModalOpen" :title="$t('police.reject.title')"
    :description="$t('police.reject.description')">
    <template #body>
      <UTextarea v-model="rejectionReason" :placeholder="$t('police.reject.placeholder')" class="w-full" />
    </template>
    <template #footer>
      <div class="flex gap-2 justify-end w-full">
        <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="isRejectModalOpen = false" />
        <UButton :label="$t('police.reject.confirm')" color="error"
          :loading="carsStore.isLoading(`${targetCarId}-reject`)" @click="confirmReject" />
      </div>
    </template>
  </UModal>

  <OrganismsPoliceCarReviewModal v-model:open="isReviewModalOpen" :car="reviewCar" :mode="reviewMode"
    @approve="handleReviewApprove" @reject="handleReviewReject" />
</template>

<script setup lang="ts">
import { useReportsStore } from '~/stores/reports'
import { useCarsStore } from '~/stores/cars'
import { useUserStore } from '~/stores/user'
import { useFinesStore } from '~/stores/fines'
import type { Report } from '~/stores/reports'

definePageMeta({
  title: 'police.title',
  role: 'police',
  containerClass: 'max-w-7xl'
})

const { t } = useI18n()
const reportsStore = useReportsStore()
const carsStore = useCarsStore()
const userStore = useUserStore()
const finesStore = useFinesStore()

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
const rejectionReason = ref('')
const targetCarId = ref('')
const isTransferRejection = ref(false)

const isReviewModalOpen = ref(false)
const reviewCar = ref<any | null>(null)
const reviewMode = ref<'activation' | 'deletion' | 'transfer'>('activation')

function openReview(car: any, mode: 'activation' | 'deletion' | 'transfer') {
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

const tabs = computed(() => [
  {
    label: t('police.tabs.cars'),
    icon: 'i-lucide-car-front',
    slot: 'cars',
    badge: filteredActivationPending.value.length +
      filteredDeletionPending.value.length +
      filteredTransferRequested.value.length
  },
  {
    label: t('police.tabs.reports'),
    icon: 'i-lucide-camera',
    slot: 'reports',
    badge: filteredPendingReports.value.length
  },
  {
    label: t('police.tabs.audit'),
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
  isDetailOpen.value = false
  isFineOpen.value = true
  if (selected.value) {
    fineForm.searching = true
    fineForm.selectedOwner = null
    try {
      const owner = await carsStore.getCarByPlate(selected.value.plateNumber)
      if (owner) {
        await userStore.fetchUser(owner.ownerId)
        fineForm.selectedOwner = userStore.usersCache[owner.ownerId]
      }
    } finally {
      fineForm.searching = false
    }
  }
}

async function confirmFine() {
  if (!selected.value || !fineForm.selectedOwner) return
  await finesStore.issueFine({
    reportId: selected.value.id,
    ownerId: fineForm.selectedOwner.id,
    plateNumber: selected.value.plateNumber,
    amount: fineForm.amount,
    notes: fineForm.notes
  })
  isFineOpen.value = false
  selected.value = null
}

function openRejectModal(carId: string, isTransfer = false) {
  targetCarId.value = carId
  isTransferRejection.value = isTransfer
  rejectionReason.value = ''
  isRejectModalOpen.value = true
}

async function confirmReject() {
  if (!targetCarId.value || !rejectionReason.value) return
  if (isTransferRejection.value) await carsStore.rejectTransfer(targetCarId.value, rejectionReason.value)
  else await carsStore.rejectCar(targetCarId.value, rejectionReason.value)
  isRejectModalOpen.value = false
}

const carColumns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'vehicle', header: 'Vehicle' },
  { accessorKey: 'ownerId', header: 'Owner' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'createdAt', header: 'Requested' },
  { id: 'actions', header: 'Actions' }
]

const deleteColumns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'vehicle', header: 'Vehicle' },
  { accessorKey: 'ownerId', header: 'Owner' },
  { accessorKey: 'status', header: 'Status' },
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