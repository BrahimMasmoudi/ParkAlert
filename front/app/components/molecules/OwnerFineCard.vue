<script setup lang="ts">
import type { Fine } from '~/stores/fines'

const props = defineProps<{
  fine: Fine
}>()

const finesStore = useFinesStore()

function formatDate(timestamp: number) {
  if (!timestamp) return 'Unknown date'
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-black/20 group">
    <div class="p-5 flex items-start justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 group-hover:bg-slate-800 transition-colors">
          <UIcon 
            :name="fine.status === 'unpaid' ? 'i-lucide-alert-triangle' : 'i-lucide-check-circle'" 
            class="w-6 h-6" 
            :class="fine.status === 'unpaid' ? 'text-red-500' : 'text-green-500'" 
          />
        </div>
        <div>
          <h3 class="text-lg font-bold text-white tracking-tight">{{ fine.plateNumber }}</h3>
          <p class="text-xs text-slate-500 font-mono tracking-widest uppercase mt-0.5">Reference: #{{ fine.id.slice(-6).toUpperCase() }}</p>
        </div>
      </div>
      
      <div class="text-right">
        <p class="text-2xl font-black text-white leading-none">TND {{ fine.amount }}</p>
        <UBadge 
          :color="fine.status === 'unpaid' ? 'error' : 'success'" 
          variant="subtle" 
          size="xs" 
          class="mt-2 font-bold uppercase tracking-wider px-2 py-0.5"
        >
          {{ fine.status }}
        </UBadge>
      </div>
    </div>

    <div v-if="fine.notes" class="px-5 pb-4">
      <div class="bg-slate-950/50 border border-slate-800/50 rounded-lg p-3">
        <p class="text-[11px] text-slate-400 italic leading-relaxed">"{{ fine.notes }}"</p>
      </div>
    </div>

    <div class="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2 text-slate-500">
        <UIcon name="i-lucide-calendar" class="w-4 h-4" />
        <span class="text-[10px] font-medium">{{ formatDate(fine.issuedAt) }}</span>
      </div>
      
      <UButton
        v-if="fine.status === 'unpaid'"
        label="Pay Fine"
        color="primary"
        size="sm"
        icon="i-lucide-credit-card"
        class="font-bold shadow-lg shadow-indigo-500/20 px-4"
        :loading="finesStore.acting"
        @click="finesStore.payFine(fine.id)"
      />
      <div v-else class="flex items-center gap-1.5 text-green-500 font-bold text-[10px] uppercase tracking-widest">
        <UIcon name="i-lucide-verified" class="w-3.5 h-3.5" />
        Receipt Issued
      </div>
    </div>
  </div>
</template>
