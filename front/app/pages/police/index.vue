<template>
  <UContainer class="w-full">
    <MoleculesPoliceSearchBar v-model="searchQuery" />

    <UTabs
      :items="tabs"
      :ui="{
        list: 'bg-slate-900 border border-slate-800 p-1 mb-8',
        indicator: 'bg-indigo-600',
        trigger: 'font-bold uppercase tracking-widest text-xs py-3'
      }"
    >
      <template #cars>
        <OrganismsPoliceCarsTab
          :activations="filteredActivationPending"
          :deletions="filteredDeletionPending"
          :transfers="filteredTransferPendingPolice"
          :loading="carsStore.pendingCarsLoading"
          :car-columns="carColumns"
          :delete-columns="deleteColumns"
          @review="openReview"
          @reject="openRejectModal"
        />
      </template>

      <template #reports>
        <OrganismsPoliceReportsTab
          :reports="filteredPendingReports"
          :loading="reportsStore.reportsLoading"
          :columns="columns"
          @open="openReport"
        />
      </template>

      <template #disputes>
        <OrganismsPoliceDisputesTab
          :fines="filteredPendingDisputes"
          :loading="finesStore.pendingDisputesLoading"
          :columns="disputeColumns"
          @open="openDispute"
        />
      </template>

      <template #audit>
        <OrganismsPoliceAuditTab
          :fines="filteredAllFines"
          :loading="finesStore.allFinesLoading"
          :columns="auditColumns"
        />
      </template>
    </UTabs>

    <UModal
      v-model:open="isReportModalOpen"
      :title="`${$t('police.fine.title')} - ${selected?.plateNumber}`"
      :description="$t('police.fine.description')"
      :ui="{
        content: 'bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-2xl overflow-hidden max-w-4xl sm:min-h-[36rem]',
        header: 'py-4 sm:py-5 border-b border-slate-800',
        body: 'p-5 sm:p-6'
      }"
    >
      <template #body>
        <div v-if="selected" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MoleculesEvidenceGallery
            :items="evidenceItems"
            :loading="loadingEvidence"
            :empty-message="$t('police.review.no_evidence')"
            @refresh="loadReportEvidence"
          />

          <div class="space-y-5">
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">
                {{ $t('police.fine.target_vehicle') }}
              </p>

              <div class="flex items-start gap-2">
                <div class="flex-1">
                  <UInput
                    v-model="fineForm.plateNumber"
                    size="xl"
                    class="font-mono text-xl uppercase tracking-widest"
                    :placeholder="$t('agent.form.plate_placeholder')"
                    @input="scheduleOwnerLookup"
                  />
                  <p v-if="fineForm.plateNumber && !isFinePlateValid" class="text-red-400 text-xs mt-1">
                    {{ $t('agent.form.invalid_plate') }}
                  </p>
                </div>
                <UButton
                  size="xl"
                  color="neutral"
                  variant="soft"
                  :loading="fineForm.searching"
                  :disabled="!isFinePlateValid"
                  :label="$t('police.fine.check_plate')"
                  @click="lookupOwner(fineForm.plateNumber)"
                />
              </div>

              <div v-if="fineForm.searching" class="mt-2 flex items-center gap-2 text-slate-400 text-sm italic">
                <UIcon name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
                {{ $t('police.fine.searching_owner') }}
              </div>

              <div
                v-else-if="fineForm.selectedOwner"
                class="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-3"
              >
                <UAvatar
                  :src="fineForm.selectedOwner.photoURL"
                  :alt="fineForm.selectedOwner.fullName || fineForm.selectedOwner.name"
                  size="sm"
                />
                <div class="min-w-0">
                  <p class="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    {{ $t('police.fine.owner_found') }}
                  </p>
                  <p class="text-sm font-bold text-white truncate">
                    {{ fineForm.selectedOwner.fullName || fineForm.selectedOwner.name }}
                  </p>
                  <p class="text-[10px] text-indigo-400 font-mono">
                    {{ fineForm.selectedOwner.identityNumber }}
                  </p>
                </div>
              </div>
              <div
                v-else
                class="mt-2 p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-xs text-red-400 flex items-center gap-2"
              >
                <UIcon name="lucide:alert-circle" class="w-4 h-4" />
                {{ $t('police.fine.no_owner_found') }}
              </div>
            </div>

            <UFormField :label="$t('police.fine.amount')">
              <UInput
                v-model="fineForm.amount"
                type="number"
                size="xl"
                icon="i-lucide-circle-dollar-sign"
              />
            </UFormField>

            <UFormField :label="$t('police.fine.notes')">
              <UTextarea v-model="fineForm.notes" :placeholder="$t('police.fine.notes_placeholder')" size="xl" />
            </UFormField>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex flex-wrap gap-3 justify-between w-full">
          <UButton
            :label="$t('police.actions.dismiss_report')"
            color="warning"
            variant="soft"
            icon="i-lucide-x-circle"
            @click="openDismissModal"
          />
          <div class="flex gap-3">
            <UButton
              :label="$t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="isReportModalOpen = false"
            />
            <UButton
              :label="$t('police.fine.confirm')"
              color="error"
              icon="i-lucide-check-circle"
              class="font-bold px-6 shadow-lg shadow-red-500/20"
              :loading="finesStore.acting"
              :disabled="!fineForm.selectedOwner || !isFinePlateValid"
              @click="confirmFine"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isDismissModalOpen"
      :title="$t('police.dismiss.title')"
      :description="$t('police.dismiss.description')"
    >
      <template #body>
        <UTextarea v-model="dismissReason" :placeholder="$t('police.dismiss.placeholder')" class="w-full" />
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end w-full">
          <UButton
            :label="$t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="isDismissModalOpen = false"
          />
          <UButton
            :label="$t('police.dismiss.confirm')"
            color="warning"
            :loading="selected ? reportsStore.isActing(selected.id) : false"
            :disabled="dismissReason.trim().length < 3"
            @click="confirmDismiss"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isRejectModalOpen"
      :title="$t('police.reject.title')"
      :description="$t('police.reject.description')"
    >
      <template #body>
        <UTextarea v-model="rejectionReason" :placeholder="$t('police.reject.placeholder')" class="w-full" />
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end w-full">
          <UButton
            :label="$t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="isRejectModalOpen = false"
          />
          <UButton
            :label="$t('police.reject.confirm')"
            color="error"
            :loading="carsStore.isLoading(`${targetCarId}-reject`)"
            @click="confirmReject"
          />
        </div>
      </template>
    </UModal>

    <OrganismsPoliceCarReviewModal
      v-model:open="isReviewModalOpen"
      :car="reviewCar"
      :mode="reviewMode"
      @approve="handleReviewApprove"
      @reject="handleReviewReject"
    />

    <UModal
      v-model:open="isDisputeModalOpen"
      :title="`${$t('police.disputes.title')} - ${selectedDispute?.plateNumber}`"
      :ui="{
        content: 'bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-2xl overflow-hidden max-w-4xl sm:min-h-[36rem]',
        header: 'py-4 sm:py-5 border-b border-slate-800',
        body: 'p-5 sm:p-6',
      }"
    >
      <template #body>
        <div v-if="selectedDispute" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MoleculesEvidenceGallery
            :items="disputeEvidenceItems"
            :loading="loadingEvidence"
            :empty-message="$t('police.review.no_evidence')"
            @refresh="loadDisputeEvidence"
          />

          <div class="space-y-4">
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {{ $t('police.disputes.issued_plate') }}
                </span>
                <span class="font-mono text-lg font-bold text-amber-400">
                  {{ selectedDispute.plateNumber }}
                </span>
              </div>

              <div
                v-if="selectedDispute.originalPlateNumber && selectedDispute.originalPlateNumber !== selectedDispute.plateNumber"
                class="flex items-center justify-between pt-2 border-t border-slate-800"
              >
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {{ $t('police.disputes.original_plate') }}
                </span>
                <span class="font-mono text-sm text-slate-300">
                  {{ selectedDispute.originalPlateNumber }}
                </span>
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-slate-800">
                <span class="text-xs text-slate-400">{{ $t('police.review.owner') }}</span>
                <AtomsUserName
                  :user="userStore.usersCache[selectedDispute.ownerId] || { name: selectedDispute.ownerId }"
                />
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-slate-800">
                <span class="text-xs text-slate-400">{{ $t('police.fine.amount') }}</span>
                <span class="font-bold text-white">TND {{ selectedDispute.amount }}</span>
              </div>
            </div>

            <div class="bg-slate-950 p-4 rounded-xl border border-amber-500/30 space-y-2">
              <p class="text-xs font-bold uppercase tracking-wider text-amber-400">
                {{ $t('police.disputes.owner_explanation') }}
              </p>
              <p class="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {{ selectedDispute.disputeReason }}
              </p>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-between w-full gap-2 flex-wrap">
          <UButton
            :label="$t('common.close')"
            color="neutral"
            variant="ghost"
            @click="isDisputeModalOpen = false"
          />
          <div class="flex items-center gap-2">
            <UButton
              :label="$t('police.disputes.dismiss_dispute')"
              color="warning"
              variant="soft"
              icon="i-lucide-shield-check"
              :loading="finesStore.acting"
              @click="openResolveDisputeModal('dismiss_dispute')"
            />
            <UButton
              :label="$t('police.disputes.cancel_fine')"
              color="error"
              icon="i-lucide-ban"
              :loading="finesStore.acting"
              @click="openResolveDisputeModal('cancel_fine')"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isResolveDisputeModalOpen"
      :title="disputeResolveAction === 'cancel_fine' ? $t('police.disputes.cancel_title') : $t('police.disputes.dismiss_title')"
      :description="disputeResolveAction === 'cancel_fine' ? $t('police.disputes.cancel_description') : $t('police.disputes.dismiss_description')"
    >
      <template #body>
        <div class="space-y-2">
          <UTextarea
            v-model="disputeResolveReason"
            :placeholder="$t('police.disputes.reason_placeholder')"
            :rows="4"
            class="w-full"
          />
          <p v-if="disputeResolveReasonError" class="text-xs text-red-400">
            {{ disputeResolveReasonError }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end w-full">
          <UButton
            :label="$t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="isResolveDisputeModalOpen = false"
          />
          <UButton
            :label="disputeResolveAction === 'cancel_fine' ? $t('police.disputes.confirm_cancel') : $t('police.disputes.confirm_dismiss')"
            :color="disputeResolveAction === 'cancel_fine' ? 'error' : 'warning'"
            :loading="finesStore.acting"
            :disabled="Boolean(disputeResolveReasonError)"
            @click="confirmResolveDispute"
          />
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

<script setup lang="ts">
import { useReportsStore } from '~/stores/reports'
import { useCarsStore } from '~/stores/cars'
import { useUserStore } from '~/stores/user'
import { useFinesStore } from '~/stores/fines'
import type { EvidenceUrlItem } from '~/composables/useDocumentViewer'
import type { Fine } from '~/stores/fines'
import type { Report } from '~/stores/reports'

definePageMeta({
  title: 'police.title',
  role: 'police',
  containerClass: 'max-w-7xl',
})

const { t } = useI18n()
const reportsStore = useReportsStore()
const carsStore = useCarsStore()
const userStore = useUserStore()
const finesStore = useFinesStore()
const { fetchEvidenceUrls, loadingEvidence } = useDocumentViewer()
const { isFrenchPlateValid, formatFrenchPlate } = useVehicleValidation()

const searchQuery = ref('')

function filterList<T extends { plateNumber?: string; ownerId?: string }>(list: T[] | null) {
  if (!list) return []
  if (!searchQuery.value.trim()) return list
  const q = searchQuery.value.toLowerCase()
  return list.filter((item) => {
    const plateMatch = item.plateNumber?.toLowerCase().includes(q)
    const owner = item.ownerId ? userStore.usersCache[item.ownerId] : null
    const ownerMatch = owner?.fullName?.toLowerCase().includes(q) || owner?.name?.toLowerCase().includes(q)
    return plateMatch || ownerMatch
  })
}

const filteredActivationPending = computed(() => filterList(carsStore.activationPendingCars))
const filteredDeletionPending = computed(() => filterList(carsStore.deletionPendingCars))
const filteredTransferPendingPolice = computed(() => filterList(carsStore.transferPendingPoliceCars))
const filteredPendingReports = computed(() => filterList(reportsStore.pendingReports))
const filteredPendingDisputes = computed(() => filterList(finesStore.pendingDisputes))
const filteredAllFines = computed(() => filterList(finesStore.allFines))

watch(() => carsStore.activationPendingCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

watch(() => carsStore.deletionPendingCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

watch(() => carsStore.transferPendingPoliceCars, (cars) => {
  cars.forEach(car => userStore.fetchUser(car.ownerId))
}, { immediate: true })

watch(() => finesStore.allFines, (fines) => {
  if (!fines) return
  fines.forEach(fine => userStore.fetchUser(fine.ownerId))
}, { immediate: true })

watch(() => finesStore.pendingDisputes, (fines) => {
  if (!fines) return
  fines.forEach(fine => userStore.fetchUser(fine.ownerId))
}, { immediate: true })

const selected = ref<Report | null>(null)
const isReportModalOpen = ref(false)
const isDismissModalOpen = ref(false)
const dismissReason = ref('')
const evidenceItems = ref<EvidenceUrlItem[]>([])

const selectedDispute = ref<Fine | null>(null)
const isDisputeModalOpen = ref(false)
const disputeEvidenceItems = ref<EvidenceUrlItem[]>([])
const isResolveDisputeModalOpen = ref(false)
const disputeResolveAction = ref<'cancel_fine' | 'dismiss_dispute'>('cancel_fine')
const disputeResolveReason = ref('')

const disputeResolveReasonError = computed(() => {
  const len = disputeResolveReason.value.trim().length
  if (len < 3 || len > 500) {
    return t('police.disputes.reason_length_error')
  }
  return ''
})

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
  plateNumber: '',
  expectedPlateNumber: '',
  selectedOwner: null as any,
  searching: false,
  amount: 100,
  notes: '',
})

const isFinePlateValid = computed(() => isFrenchPlateValid(fineForm.plateNumber.trim()))

watch(() => fineForm.plateNumber, (val) => {
  if (val) fineForm.plateNumber = formatFrenchPlate(val)
})

const tabs = computed(() => [
  {
    label: t('police.tabs.cars'),
    icon: 'i-lucide-car-front',
    slot: 'cars',
    badge: filteredActivationPending.value.length
      + filteredDeletionPending.value.length
      + filteredTransferPendingPolice.value.length,
  },
  {
    label: t('police.tabs.reports'),
    icon: 'i-lucide-camera',
    slot: 'reports',
    badge: filteredPendingReports.value.length,
  },
  {
    label: t('police.tabs.disputes'),
    icon: 'i-lucide-scale',
    slot: 'disputes',
    badge: filteredPendingDisputes.value.length,
  },
  {
    label: t('police.tabs.audit'),
    icon: 'i-lucide-history',
    slot: 'audit',
    badge: filteredAllFines.value.length,
  },
])

async function loadReportEvidence() {
  if (!selected.value) return
  try {
    evidenceItems.value = await fetchEvidenceUrls('report', selected.value.id)
  }
  catch {
    evidenceItems.value = []
  }
}

let lookupTimer: ReturnType<typeof setTimeout> | null = null
let lookupNonce = 0

function scheduleOwnerLookup() {
  if (lookupTimer) clearTimeout(lookupTimer)
  lookupTimer = setTimeout(() => {
    if (isFinePlateValid.value) {
      lookupOwner(fineForm.plateNumber)
    }
    else {
      fineForm.selectedOwner = null
    }
  }, 300)
}

async function lookupOwner(plate: string) {
  const currentNonce = ++lookupNonce
  fineForm.searching = true
  fineForm.selectedOwner = null
  try {
    const car = await carsStore.getCarByPlate(plate)
    if (currentNonce !== lookupNonce) return
    if (car) {
      await userStore.fetchUser(car.ownerId)
      if (currentNonce !== lookupNonce) return
      fineForm.selectedOwner = userStore.usersCache[car.ownerId]
    }
  }
  finally {
    if (currentNonce === lookupNonce) {
      fineForm.searching = false
    }
  }
}

async function openReport(report: Report) {
  selected.value = report
  fineForm.plateNumber = report.plateNumber
  fineForm.expectedPlateNumber = report.plateNumber
  fineForm.selectedOwner = null
  evidenceItems.value = []
  isReportModalOpen.value = true
  await Promise.all([
    loadReportEvidence(),
    lookupOwner(report.plateNumber),
  ])
}

async function confirmFine() {
  if (!selected.value || !fineForm.selectedOwner || !isFinePlateValid.value) return
  await finesStore.issueFine({
    reportId: selected.value.id,
    ownerId: fineForm.selectedOwner.id,
    plateNumber: fineForm.plateNumber.trim().toUpperCase(),
    expectedPlateNumber: fineForm.expectedPlateNumber,
    amount: fineForm.amount,
    notes: fineForm.notes,
  })
  isReportModalOpen.value = false
  selected.value = null
}

function openDismissModal() {
  dismissReason.value = ''
  isDismissModalOpen.value = true
}

async function confirmDismiss() {
  if (!selected.value || dismissReason.value.trim().length < 3) return
  await reportsStore.dismissReport(selected.value.id, dismissReason.value.trim())
  isDismissModalOpen.value = false
  isReportModalOpen.value = false
  selected.value = null
}

async function loadDisputeEvidence() {
  if (!selectedDispute.value) return
  try {
    disputeEvidenceItems.value = await fetchEvidenceUrls('fine', selectedDispute.value.id)
  }
  catch {
    disputeEvidenceItems.value = []
  }
}

async function openDispute(fine: Fine) {
  selectedDispute.value = fine
  disputeEvidenceItems.value = []
  isDisputeModalOpen.value = true
  userStore.fetchUser(fine.ownerId)
  await loadDisputeEvidence()
}

function openResolveDisputeModal(action: 'cancel_fine' | 'dismiss_dispute') {
  disputeResolveAction.value = action
  disputeResolveReason.value = ''
  isResolveDisputeModalOpen.value = true
}

async function confirmResolveDispute() {
  if (!selectedDispute.value || disputeResolveReasonError.value) return
  await finesStore.resolveDispute(
    selectedDispute.value.id,
    disputeResolveAction.value,
    disputeResolveReason.value.trim(),
  )
  isResolveDisputeModalOpen.value = false
  isDisputeModalOpen.value = false
  selectedDispute.value = null
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
  { id: 'actions', header: 'Actions' },
]

const deleteColumns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'vehicle', header: 'Vehicle' },
  { accessorKey: 'ownerId', header: 'Owner' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'createdAt', header: 'Requested' },
  { id: 'actions', header: 'Actions' },
]

const columns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'address', header: 'Location' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'timestamp', header: 'Time' },
  { id: 'actions', header: 'Actions' },
]

const auditColumns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'ownerId', header: 'Owner' },
  { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'issuedAt', header: 'Issued' },
]

const disputeColumns = [
  { accessorKey: 'plateNumber', header: 'Plate' },
  { accessorKey: 'ownerId', header: 'Owner' },
  { accessorKey: 'amount', header: 'Amount' },
  { accessorKey: 'disputeReason', header: 'Explanation' },
  { accessorKey: 'disputedAt', header: 'Submitted' },
  { id: 'actions', header: 'Actions' },
]
</script>
