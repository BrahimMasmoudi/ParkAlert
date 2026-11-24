<template>
  <UContainer class="py-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">{{ $t('police.audit.title') }}</h2>
    </div>
    <LoadingSkeleton v-if="loading" :count="8" />
    <div v-else-if="!fines.length" class="text-center py-12 text-muted bg-elevated rounded-xl border border-default">
      <UIcon name="lucide:clipboard-list" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
      <p>{{ $t('police.audit.no_fines') }}</p>
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
        <span class="text-sm text-muted">{{ new Date(row.original.issuedAt).toLocaleString($i18n.locale) }}</span>
      </template>
      <template #actions-cell="{ row }">
        <UButton
          v-if="row.original.status === 'paid'"
          size="xs"
          color="neutral"
          variant="soft"
          icon="i-lucide-receipt-text"
          :label="$t('police.audit.view_receipt_button')"
          @click="emit('receipt', row.original)"
        />
        <span v-else class="text-muted">—</span>
      </template>
    </UTable>
  </UContainer>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Fine } from '~/stores/fines'
import { useUserStore } from '~/stores/user'

defineProps<{
  fines: Fine[]
  loading: boolean
  columns: TableColumn<Fine>[]
}>()

const emit = defineEmits<{
  (e: 'receipt', fine: Fine): void
}>()

const userStore = useUserStore()

function statusColor(status: string) {
  if (status === 'paid') return 'success'
  if (status === 'cancelled') return 'neutral'
  return 'error'
}
</script>
