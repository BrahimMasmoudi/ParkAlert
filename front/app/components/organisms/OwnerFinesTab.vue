<template>
  <section class="space-y-6">
    <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
      <div>
        <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <UIcon name="lucide:circle-dollar-sign" class="w-5 h-5 text-red-500" />
          Parking Fines
        </h2>
        <p class="text-sm text-slate-400 mt-1">View and settle your vehicle violations</p>
      </div>
    </div>

    <LoadingSkeleton v-if="loading" :count="3" class="h-32 mb-4" />

    <div v-else-if="!fines?.length" class="flex flex-col items-center justify-center py-20 bg-slate-900 border border-slate-800 border-dashed rounded-2xl">
      <div class="p-4 bg-slate-800 rounded-full mb-4">
        <UIcon name="lucide:smile" class="w-8 h-8 text-green-500" />
      </div>
      <p class="text-lg text-white font-bold tracking-tight">No fines found</p>
      <p class="text-slate-400 text-sm mt-2 max-w-sm text-center">You have no pending or past fines. Good job on following parking regulations!</p>
    </div>

    <div v-else class="space-y-4">
      <div v-if="unpaidFines.length" class="flex items-center gap-2 mb-2">
        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Unpaid Violations</span>
        <div class="h-px flex-1 bg-red-950"></div>
      </div>

      <MoleculesOwnerFineCard
        v-for="fine in unpaidFines"
        :key="fine.id"
        :fine="fine"
      />

      <div v-if="paidFines.length" class="flex items-center gap-2 mt-8 mb-2">
        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Settled Records</span>
        <div class="h-px flex-1 bg-slate-800"></div>
      </div>

      <MoleculesOwnerFineCard
        v-for="fine in paidFines"
        :key="fine.id"
        :fine="fine"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  fines: any[]
  loading: boolean
}>()

const unpaidFines = computed(() => (props.fines || []).filter(f => f.status === 'unpaid'))
const paidFines = computed(() => (props.fines || []).filter(f => f.status === 'paid'))
</script>
