<script setup lang="ts">
import type { CarStatus } from '~/stores/cars'

defineProps<{
  car: {
    id: string
    plateNumber: string
    status: CarStatus | 'delete_pending'
    brand: string
    model: string
    color: string
    carteGriseUrl: string
  }
}>()

defineEmits<{
  (e: 'delete', id: string): void
}>()
</script>

<template>
  <UCard
    class="group transition-all duration-300 relative overflow-hidden border shadow-lg hover:shadow-xl"
    :class="car.status === 'delete_pending' 
      ? 'bg-slate-900/40 border-slate-800 opacity-75 grayscale-[0.5]' 
      : 'bg-slate-900 border-slate-700 hover:border-slate-500'"
    :ui="{ body: { padding: 'p-0 sm:p-0' } }"
  >
    <!-- Card Header (Plate & Status) -->
    <div class="p-5 border-b border-slate-800/50 flex justify-between items-start" :class="car.status === 'delete_pending' ? 'bg-amber-950/20' : 'bg-slate-800/20'">
      <div>
        <div class="flex items-center gap-3">
          <div class="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-lg font-mono font-bold text-white tracking-[0.15em] shadow-inner">
            {{ car.plateNumber }}
          </div>
        </div>
        <div class="mt-3">
          <UBadge
            :color="car.status === 'active' ? 'success' : (car.status === 'activation_pending' || car.status === 'delete_pending' ? 'warning' : (car.status === 'rejected' ? 'error' : 'neutral'))"
            variant="subtle"
            class="capitalize font-semibold text-xs px-2.5 py-1"
          >
            {{ car.status.replace('_', ' ') }}
          </UBadge>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <UTooltip v-if="car.status === 'delete_pending'" text="Cancel Deletion Request">
          <UButton
            color="primary"
            variant="soft"
            icon="lucide:rotate-ccw"
            size="sm"
            class="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
            @click="$emit('delete', car.id)" 
          />
          <!-- The parent can handle the cancel deletion by detecting the status -->
        </UTooltip>
        
        <UTooltip v-else-if="car.status !== 'deleted'" text="Request Deletion">
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

    <!-- Card Body (Details) -->
    <div class="p-5 grid grid-cols-2 gap-6 bg-slate-900">
      <div>
        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Brand & Model</p>
        <p class="text-sm text-slate-200 font-medium capitalize">{{ car.brand }} {{ car.model }}</p>
      </div>
      <div>
        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Color</p>
        <p class="text-sm text-slate-200 font-medium capitalize">{{ car.color }}</p>
      </div>
    </div>

    <!-- Card Footer (Action) -->
    <div class="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="lucide:file-text" class="w-4 h-4 text-slate-500" />
        <span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Carte Grise</span>
      </div>
      <UButton
        :to="car.carteGriseUrl"
        target="_blank"
        color="primary"
        variant="link"
        icon="lucide:external-link"
        label="View Doc"
        :padded="false"
        class="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
      />
    </div>
  </UCard>
</template>
