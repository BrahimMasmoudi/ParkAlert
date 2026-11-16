<template>
  <UContainer class="py-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">{{ $t('police.audit.title') }}</h2>
    </div>
    <LoadingSkeleton v-if="loading" :count="8" />
    <div v-else-if="!fines.length" class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
      <UIcon name="lucide:clipboard-list" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
      <p>{{ $t('police.audit.no_fines') }}</p>
    </div>
    <UTable v-else :data="fines" :columns="columns">
      <template #plateNumber-cell="{ row }">
        <span class="font-mono font-bold text-amber-400">{{ row.original.plateNumber }}</span>
      </template>
      <template #ownerId-cell="{ row }">
        <AtomsUserName :user="userStore.usersCache[row.original.ownerId] || { name: row.original.ownerId }" />
      </template>
      <template #amount-cell="{ row }">
        <span class="font-bold text-white">TND {{ row.original.amount }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="statusColor(row.original.status)"
          variant="subtle"
          size="xs"
          class="uppercase font-bold"
        >
          {{ $t(`police.audit.${row.original.status}`) || row.original.status }}
        </UBadge>
      </template>
      <template #issuedAt-cell="{ row }">
        <span class="text-sm text-slate-400">{{ new Date(row.original.issuedAt).toLocaleString($i18n.locale) }}</span>
      </template>
    </UTable>
  </UContainer>
</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/user'

defineProps<{
  fines: any[]
  loading: boolean
  columns: any[]
}>()

const userStore = useUserStore()

function statusColor(status: string) {
  if (status === 'paid') return 'success'
  if (status === 'cancelled') return 'neutral'
  return 'error'
}
</script>
