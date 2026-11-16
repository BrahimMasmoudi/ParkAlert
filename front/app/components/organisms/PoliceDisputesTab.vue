<template>
  <UContainer class="py-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">{{ $t('police.disputes.title') }}</h2>
      <UBadge v-if="!loading" color="warning" variant="soft">{{ fines.length }}</UBadge>
    </div>
    <LoadingSkeleton v-if="loading" :count="5" />
    <div
      v-else-if="!fines.length"
      class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800"
    >
      <UIcon name="lucide:scale" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
      <p>{{ $t('police.disputes.no_disputes') }}</p>
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
      <template #disputeReason-cell="{ row }">
        <span class="text-xs text-slate-300 line-clamp-2 max-w-xs">{{ row.original.disputeReason }}</span>
      </template>
      <template #disputedAt-cell="{ row }">
        <span class="text-sm text-slate-400">
          {{ row.original.disputedAt ? new Date(row.original.disputedAt).toLocaleString($i18n.locale) : '-' }}
        </span>
      </template>
      <template #actions-cell="{ row }">
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          icon="lucide:eye"
          @click="$emit('open', row.original)"
        >
          {{ $t('common.view_details') }}
        </UButton>
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

defineEmits(['open'])

const userStore = useUserStore()
</script>
