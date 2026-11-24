<template>
  <section class="space-y-6">
    <div class="flex items-center justify-between mb-6 border-b border-default pb-4">
      <div>
        <h2 class="text-xl font-bold text-highlighted tracking-tight flex items-center gap-2">
          <UIcon name="lucide:circle-dollar-sign" class="w-5 h-5 text-red-600 dark:text-red-500" />
          {{ $t('owner.fines.title') }}
        </h2>
        <p class="text-sm text-muted mt-1">{{ $t('owner.fines.subtitle') }}</p>
      </div>
    </div>

    <LoadingSkeleton v-if="loading" :count="3" class="h-32 mb-4" />

    <div
      v-else-if="!fines?.length"
      class="flex flex-col items-center justify-center py-20 bg-elevated border border-default border-dashed rounded-2xl"
    >
      <div class="p-4 bg-muted rounded-full mb-4">
        <UIcon name="lucide:smile" class="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
      </div>
      <p class="text-lg text-highlighted font-bold tracking-tight">{{ $t('owner.fines.no_fines') }}</p>
      <p class="text-muted text-sm mt-2 max-w-sm text-center">{{ $t('owner.fines.empty_state_desc') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div v-if="unpaidFines.length" class="flex items-center gap-2 mb-2">
        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-red-700 dark:text-red-400">{{ $t('owner.fines.unpaid_title') }}</span>
        <div class="h-px flex-1 bg-red-500/25" />
      </div>

      <MoleculesOwnerFineCard
        v-for="fine in unpaidFines"
        :key="fine.id"
        :fine="fine"
        @pay="handleOpenPayModal"
      />

      <div v-if="paidFines.length" class="flex items-center gap-2 mt-8 mb-2">
        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{{ $t('owner.fines.settled_title') }}</span>
        <div class="h-px flex-1 bg-default border-b border-default" />
      </div>

      <MoleculesOwnerFineCard
        v-for="fine in paidFines"
        :key="fine.id"
        :fine="fine"
      />

      <div v-if="cancelledFines.length" class="flex items-center gap-2 mt-8 mb-2">
        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{{ $t('owner.fines.cancelled_title') }}</span>
        <div class="h-px flex-1 bg-default border-b border-default" />
      </div>

      <MoleculesOwnerFineCard
        v-for="fine in cancelledFines"
        :key="fine.id"
        :fine="fine"
      />
    </div>

    <OrganismsOwnerPayFineModal
      v-model:open="isPayModalOpen"
      :fine="activePayFine"
      :loading="props.loading"
    />
  </section>
</template>

<script setup lang="ts">
import type { Fine } from '~/stores/fines'

const props = defineProps<{
  fines: Fine[]
  loading: boolean
}>()

const isPayModalOpen = ref(false)
const selectedPayFineId = ref<string | null>(null)
let clearTimer: ReturnType<typeof setTimeout> | null = null

const unpaidFines = computed(() => (props.fines || []).filter(f => f.status === 'unpaid'))
const paidFines = computed(() => (props.fines || []).filter(f => f.status === 'paid'))
const cancelledFines = computed(() => (props.fines || []).filter(f => f.status === 'cancelled'))

const activePayFine = computed(
  () => (selectedPayFineId.value ? (props.fines || []).find(f => f.id === selectedPayFineId.value) ?? null : null),
)

const handleOpenPayModal = (fine: Fine) => {
  if (clearTimer) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
  selectedPayFineId.value = fine.id
  isPayModalOpen.value = true
}

watch(isPayModalOpen, (isOpen) => {
  if (!isOpen) {
    clearTimer = setTimeout(() => {
      selectedPayFineId.value = null
      clearTimer = null
    }, 300)
  }
})

onBeforeUnmount(() => {
  if (clearTimer) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
})
</script>
