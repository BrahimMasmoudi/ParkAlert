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
            :color="car.status === 'active' ? 'success' : (car.status === 'activation_pending' || car.status === 'deletion_requested' || car.status === 'transfer_requested' ? 'warning' : (car.status === 'rejected' ? 'error' : 'neutral'))"
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
            class="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
            :loading="carsStore.isLoading(car.id)"
            @click="$emit('delete', car.id)"
          />
        </UTooltip>

        <UTooltip v-if="car.status === 'active'" :text="$t('owner.car.transfer_tooltip')">
          <UButton
            color="primary"
            variant="ghost"
            icon="lucide:arrow-right-left"
            class="transition-opacity p-2 -m-2 mr-1"
            @click="$emit('transfer', car.id)"
          />
        </UTooltip>

        <UTooltip v-else-if="car.status !== 'deleted' && car.status !== 'deletion_requested'" :text="$t('owner.car.delete_tooltip')">
          <UButton
            color="error"
            variant="ghost"
            icon="lucide:trash-2"
            class="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 p-2 -m-2"
            @click="$emit('delete', car.id)"
          />
        </UTooltip>
      </div>
    </div>

    <div class="p-5 grid grid-cols-2 gap-6 bg-slate-900">
      <div>
        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{{ $t('owner.car.brand_model') }}</p>
        <p class="text-sm text-slate-200 font-medium capitalize">{{ car.brand }} {{ car.model }}</p>
      </div>
      <div>
        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{{ $t('owner.car.color') }}</p>
        <p class="text-sm text-slate-200 font-medium capitalize">{{ car.color }}</p>
      </div>
    </div>

    <div v-if="car.status === 'rejected' && car.rejectionReason" class="px-5 pb-5 bg-slate-900">
      <div class="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
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
    </div>

    <div v-if="!readonly && car.status === 'active' && car.transferRejectionReason" class="px-5 pb-5 bg-slate-900">
      <div class="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
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
        <span class="text-xs text-slate-400 font-medium uppercase tracking-wider">{{ $t('owner.car.carte_grise') }}</span>
      </div>
      <UButton
        :to="car.carteGriseUrl"
        target="_blank"
        color="primary"
        variant="link"
        icon="lucide:external-link"
        :label="$t('owner.car.view_doc')"
        :padded="false"
        class="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
      />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { CarStatus } from '~/stores/cars'
import { useCarsStore } from '~/stores/cars'

const carsStore = useCarsStore()

const { car } = defineProps<{
  car: {
    id: string
    plateNumber: string
    status: CarStatus | 'deletion_requested'
    brand: string
    model: string
    color: string
    carteGriseUrl: string
    rejectionReason?: string
    transferRejectionReason?: string
  }
  readonly?: boolean
}>()

defineEmits<{
  (e: 'delete', id: string): void
  (e: 'retry', id: string): void
  (e: 'transfer', id: string): void
}>()

const finesStore = useFinesStore()
const unpaidFinesCount = computed(() => {
  return finesStore.myFines?.filter(f => f.plateNumber === car.plateNumber && f.status === 'unpaid').length || 0
})
</script>
