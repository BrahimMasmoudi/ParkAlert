<template>
  <UContainer class="py-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">{{ $t('police.pending_reports') }}</h2>
      <UBadge v-if="!loading" color="warning" variant="soft">{{ reports.length }}</UBadge>
    </div>
    <LoadingSkeleton v-if="loading" :count="5" />
    <div v-else-if="!reports.length" class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
      <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
      <p>{{ $t('police.no_reports') }}</p>
    </div>
    <UTable v-else :data="reports" :columns="columns">
      <template #plateNumber-cell="{ row }">
        <span class="font-mono font-bold text-amber-400">{{ row.original.plateNumber }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge color="warning" variant="soft">{{ row.original.status }}</UBadge>
      </template>
      <template #timestamp-cell="{ row }">
        <span class="text-sm text-slate-400">{{ new Date(row.original.timestamp).toLocaleString() }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex gap-2">
          <UButton size="xs" color="neutral" variant="soft" icon="lucide:eye" @click="$emit('open', row.original)">{{ $t('common.view_details') }}</UButton>
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
