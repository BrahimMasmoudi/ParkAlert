<template>
  <UContainer class="py-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">{{ $t('police.disputes.title') }}</h2>
      <UBadge v-if="!loading" color="warning" variant="soft">{{ fines.length }}</UBadge>
    </div>
    <LoadingSkeleton v-if="loading" :count="5" />
    <div
      v-else-if="!fines.length"
      class="text-center py-12 text-muted bg-elevated rounded-xl border border-default"
    >
      <UIcon name="lucide:scale" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
      <p>{{ $t('police.disputes.no_disputes') }}</p>
    </div>
    <UTable v-else :data="fines" :columns="columns">
      <template #plateNumber-cell="{ row }">
        <span dir="ltr" class="font-mono font-bold text-amber-700 dark:text-amber-400">{{ row.original.plateNumber }}</span>
      </template>
      <template #ownerId-cell="{ row }">
        <AtomsUserName :user="userStore.usersCache[row.original.ownerId] || { name: row.original.ownerId }" />
      </template>
      <template #amount-cell="{ row }">
        <span dir="ltr" class="font-bold text-highlighted">TND {{ row.original.amount }}</span>
      </template>
      <template #disputeReason-cell="{ row }">
        <span class="text-xs text-default line-clamp-2 max-w-xs">{{ row.original.disputeReason }}</span>
      </template>
      <template #disputedAt-cell="{ row }">
        <span class="text-sm text-muted">
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
