<template>
  <UCard
    class="group transition-all duration-300 relative overflow-hidden border shadow-lg hover:shadow-xl"
    :class="car.status === 'deletion_requested'
      ? 'bg-slate-900/40 border-slate-800 opacity-75 grayscale-[0.5]'
      : 'bg-slate-900 border-slate-700 hover:border-slate-500'"
    :ui="{ body: { padding: 'p-0 sm:p-0' } }"
  >
    <div
      class="p-5 border-b border-slate-800/50 flex justify-between items-start"
      :class="car.status === 'deletion_requested' ? 'bg-amber-950/20' : 'bg-slate-800/20'"
    >
      <div>
        <div class="flex items-center gap-3">
          <div
            class="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-lg font-mono font-bold text-white tracking-[0.15em] shadow-inner"
          >
            {{ car.plateNumber }}
          </div>
          <UBadge
            v-if="unpaidFinesCount > 0"
            color="error"
            variant="solid"
            size="xs"
            class="animate-pulse shadow-lg shadow-red-500/40 font-black"
          >
            {{ unpaidFinesCount }} {{ $t('owner.car.violations', unpaidFinesCount) }}
          </UBadge>
        </div>
        <div class="mt-3">
          <UBadge
            v-if="readonly"
            color="neutral"
            variant="subtle"
            class="font-semibold text-xs px-2.5 py-1"
          >
            <UIcon name="lucide:arrow-right-left" class="w-3 h-3 mr-1" />
            {{ $t('owner.car.transferred') }}
          </UBadge>
          <UBadge
            v-else
            :color="car.status === 'active' ? 'success' : (['activation_pending', 'deletion_requested', 'transfer_pending_owner', 'transfer_pending_police'].includes(car.status) ? 'warning' : (car.status === 'rejected' ? 'error' : 'neutral'))"
            variant="subtle"
            class="capitalize font-semibold text-xs px-2.5 py-1"
          >
            {{ $t(`police.cars.status.${car.status}`) || car.status.replace(/_/g, ' ') }}
          </UBadge>
        </div>
      </div>

      <div v-if="!readonly" class="flex items-center gap-2">
        <UTooltip v-if="car.status === 'deletion_requested'" :text="$t('owner.car.cancel_deletion_tooltip')">
          <UButton
            color="primary"
            variant="soft"
            icon="lucide:rotate-ccw"
            size="sm"
            class="transition-opacity"
            :loading="carsStore.isLoading(car.id)"
            @click="$emit('delete', car.id)"
          />
        </UTooltip>

        <UTooltip
          v-else-if="car.status !== 'archived' && car.status !== 'deletion_requested' && car.status !== 'transfer_pending_owner' && car.status !== 'transfer_pending_police'"
          :text="$t('owner.car.delete_tooltip')"
        >
          <UButton
            color="error"
            variant="ghost"
            icon="lucide:trash-2"
            class="transition-opacity"
            @click="$emit('delete', car.id)"
          />
        </UTooltip>
      </div>
    </div>

    <div class="p-5 grid grid-cols-2 gap-6 bg-slate-900">
      <div>
        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">
          {{ $t('owner.car.brand_model') }}
        </p>
        <p class="text-sm text-slate-200 font-medium capitalize">{{ car.brand }} {{ car.model }}</p>
      </div>
      <div>
        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{{ $t('owner.car.color') }}</p>
        <p class="text-sm text-slate-200 font-medium capitalize">{{ car.color }}</p>
      </div>
    </div>

    <div v-if="!readonly" class="pb-5 bg-slate-900">
      <!-- Rejection Reason for Registration -->
      <div
        v-if="car.status === 'rejected' && car.rejectionReason"
        class="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mb-4"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <UIcon name="lucide:alert-circle" class="w-3.5 h-3.5" />
              {{ $t('owner.car.rejection_reason') }}
            </p>
            <p class="text-sm text-red-200 leading-snug">{{ car.rejectionReason }}</p>
          </div>
          <UButton
            color="white"
            variant="solid"
            size="sm"
            icon="lucide:refresh-cw"
            @click="$emit('retry', car.id)"
          >
            {{ $t('common.retry') }}
          </UButton>
        </div>
      </div>

      <!-- Incoming Transfer Request (Collapsible) -->
      <UCollapsible
        v-if="car.status === 'transfer_pending_owner'"
        class="bg-indigo-950/20 border-t border-indigo-500/20"
      >
        <template #default="{ open }">
          <div class="py-4 flex items-center justify-between cursor-pointer hover:bg-indigo-500/5 transition-colors">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-indigo-500/20 rounded-full text-indigo-400">
                <UIcon name="lucide:arrow-right-left" class="w-4 h-4" />
              </div>
              <span class="text-indigo-300 font-bold text-xs tracking-wider uppercase">{{
                $t('owner.car.incoming_transfer_title') }}</span>
            </div>
            <div class="flex items-center gap-3">
              <UBadge
                color="primary"
                variant="soft"
                size="xs"
                class="font-bold"
              >
                {{ $t('owner.car.action_required') }}
              </UBadge>
              <UIcon
                name="lucide:chevron-down"
                class="w-5 h-5 text-indigo-400 transition-transform duration-200"
                :class="open ? 'rotate-180' : ''"
              />
            </div>
          </div>
        </template>

        <template #content>
          <div class="pb-6">
            <div class="bg-indigo-900/10 rounded-xl p-5 border border-indigo-500/10">
              <p class="text-slate-300 text-sm leading-relaxed mb-6">{{ $t('owner.car.incoming_transfer_desc') }}</p>

              <!-- Requester Info Card -->
              <div class="bg-slate-950/50 rounded-lg p-4 mb-6 border border-indigo-500/10">
                <p class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-3">
                  {{ $t('owner.car.proposed_new_owner') }}
                </p>
                <div class="flex items-center gap-4">
                  <UAvatar
                    :src="requester?.photoURL"
                    :alt="requester?.fullName || requester?.name"
                    size="lg"
                    class="ring-2 ring-indigo-500/20 flex-shrink-0"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-slate-100 font-bold truncate">
                      {{ requester?.fullName || requester?.name || $t('common.loading') }}
                    </p>
                    <div class="flex flex-col gap-1 mt-1">
                      <p v-if="requester?.email" class="text-xs text-slate-400 flex items-center gap-1.5 min-w-0">
                        <UIcon name="lucide:mail" class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate">{{ requester.email }}</span>
                      </p>
                      <p
                        v-if="requester?.identityNumber"
                        class="text-xs text-indigo-300 font-mono flex items-center gap-1.5 min-w-0"
                      >
                        <UIcon name="lucide:id-card" class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate">{{ requester.identityNumber }}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3">
                <UButton
                  color="error"
                  variant="soft"
                  size="md"
                  icon="lucide:x-circle"
                  class="flex-1 justify-center font-semibold"
                  :loading="carsStore.isLoading(`${car.id}-reject`)"
                  @click="openRejectTransferModal"
                >
                  {{ $t('owner.car.reject_transfer_button') }}
                </UButton>
                <UButton
                  color="primary"
                  variant="solid"
                  size="md"
                  icon="lucide:check-circle"
                  class="flex-1 justify-center font-bold shadow-lg shadow-indigo-500/20"
                  :loading="carsStore.isLoading(`${car.id}-acknowledge`)"
                  @click="carsStore.acknowledgeTransfer(car.id)"
                >
                  {{ $t('owner.car.acknowledge_button') }}
                </UButton>
              </div>
            </div>
          </div>
        </template>
      </UCollapsible>

      <!-- Transfer Rejected Reason -->
      <div
        v-if="car.status === 'active' && car.transferRejectionReason"
        class="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mt-4"
      >
        <div class="flex items-start gap-4">
          <div>
            <p class="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <UIcon name="lucide:alert-circle" class="w-3.5 h-3.5" />
              {{ $t('owner.car.transfer_rejected') }}
            </p>
            <p class="text-sm text-red-200 leading-snug">{{ car.transferRejectionReason }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="lucide:file-text" class="w-4 h-4 text-slate-500" />
        <span class="text-xs text-slate-400 font-medium uppercase tracking-wider">
          {{ $t('owner.car.carte_grise') }}
        </span>
      </div>
      <UButton
        color="primary"
        variant="link"
        icon="lucide:external-link"
        :label="$t('owner.car.view_doc')"
        :loading="isOpening(car.id, 'active')"
        :padded="false"
        class="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
        @click="openDocument(car.id, 'active', car.carteGriseUrl)"
      />
    </div>

    <!-- Owner Transfer Rejection Reason Modal -->
    <UModal
      v-model:open="isRejectModalOpen"
      :title="$t('owner.modals.reject_transfer.title')"
      :description="$t('owner.modals.reject_transfer.description')"
    >
      <template #body>
        <UFormField
          :label="$t('owner.modals.reject_transfer.reason_label')"
          :error="rejectionReasonError"
          required
        >
          <UTextarea
            v-model="rejectionReasonInput"
            :placeholder="$t('owner.modals.reject_transfer.placeholder')"
            :rows="3"
            class="w-full"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3 w-full">
          <UButton
            :label="$t('common.cancel')"
            color="neutral"
            variant="soft"
            @click="isRejectModalOpen = false"
          />
          <UButton
            :label="$t('owner.modals.reject_transfer.confirm_button')"
            color="error"
            :disabled="!isRejectionReasonValid"
            :loading="carsStore.isLoading(`${car.id}-reject`)"
            @click="submitRejectTransfer"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>

<script setup lang="ts">
import type { CarStatus } from '~/stores/cars'
import { useCarsStore } from '~/stores/cars'
import { useDocumentViewer } from '~/composables/useDocumentViewer'
import { normalizePlate } from '~/composables/useVehicleValidation'

const { t } = useI18n()
const carsStore = useCarsStore()
const { openDocument, isOpening } = useDocumentViewer()

const { car } = defineProps<{
  car: {
    id: string
    plateNumber: string
    status: CarStatus
    brand: string
    model: string
    color: string
    carteGriseUrl: string
    rejectionReason?: string
    transferRejectionReason?: string
    transferToOwnerId?: string
  }
  readonly?: boolean
}>()

defineEmits<{
  (e: 'delete', id: string): void
  (e: 'retry', id: string): void
}>()

const userStore = useUserStore()
const requester = ref<any>(null)

watchEffect(async () => {
  if (car.transferToOwnerId && car.status === 'transfer_pending_owner') {
    requester.value = await userStore.fetchUser(car.transferToOwnerId)
  }
})

const finesStore = useFinesStore()
const unpaidFinesCount = computed(() => {
  const targetPlate = normalizePlate(car.plateNumber)
  return finesStore.myFines?.filter(
    f => normalizePlate(f.plateNumber) === targetPlate && f.status === 'unpaid'
  ).length || 0
})

const isRejectModalOpen = ref(false)
const rejectionReasonInput = ref('')

const trimmedRejectionReason = computed(() => rejectionReasonInput.value.trim())
const isRejectionReasonValid = computed(() => {
  const len = trimmedRejectionReason.value.length
  return len >= 3 && len <= 500
})
const rejectionReasonError = computed(() => {
  if (!rejectionReasonInput.value) return ''
  if (!isRejectionReasonValid.value) {
    return t('owner.modals.reject_transfer.reason_length_error')
  }
  return ''
})

function openRejectTransferModal() {
  rejectionReasonInput.value = ''
  isRejectModalOpen.value = true
}

async function submitRejectTransfer() {
  if (!isRejectionReasonValid.value) return
  await carsStore.rejectTransfer(car.id, trimmedRejectionReason.value)
  isRejectModalOpen.value = false
  rejectionReasonInput.value = ''
}
</script>
