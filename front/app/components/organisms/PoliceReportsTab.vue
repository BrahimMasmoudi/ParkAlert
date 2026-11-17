<template>
  <UContainer class="py-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">{{ $t('police.pending_reports') }}</h2>
      <UBadge v-if="!loading" color="warning" variant="soft">{{ reports.length }}</UBadge>
    </div>
    <LoadingSkeleton v-if="loading" :count="5" />
    <div v-else-if="!reports.length" class="text-center py-12 text-muted bg-elevated rounded-xl border border-default">
      <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
      <p>{{ $t('police.no_reports') }}</p>
    </div>
    <UTable v-else :data="reports" :columns="columns">
      <template #plateNumber-cell="{ row }">
        <span dir="ltr" class="font-mono font-bold text-amber-700 dark:text-amber-400">{{ row.original.plateNumber }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge color="warning" variant="soft">{{ row.original.status }}</UBadge>
      </template>
      <template #timestamp-cell="{ row }">
        <span class="text-sm text-muted">{{ new Date(row.original.timestamp).toLocaleString() }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="lucide:eye"
            @click="$emit('open', row.original)"
          >{{ $t('common.view_details') }}</UButton>
        </div>
      </template>
    </UTable>
  </UContainer>
</template>

<script setup lang="ts">
defineProps<{
  reports: any[]
  loading: boolean
  columns: any[]
}>()
defineEmits(['open'])
</script>
