<template>
  <UContainer class="py-6">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold">{{ $t('police.pending_reports') }}</h2>
        <UBadge v-if="!loading" color="warning" variant="soft">
          {{ atCap ? '250+' : reports.length }}
        </UBadge>
      </div>
      <UButton
        size="xs"
        color="neutral"
        variant="soft"
        :icon="sortOrder === 'asc' ? 'lucide:arrow-up-narrow-wide' : 'lucide:arrow-down-wide-narrow'"
        @click="toggleSortOrder"
      >
        {{ sortOrder === 'asc' ? $t('police.sort.oldest_first') : $t('police.sort.newest_first') }}
      </UButton>
    </div>
    <UAlert
      v-if="atCap && !loading"
      color="warning"
      variant="soft"
      icon="lucide:info"
      class="mb-4"
      :description="$t('police.sort.oldest_cap_notice')"
    />
    <LoadingSkeleton v-if="loading" :count="5" />
    <div v-else-if="!sortedReports.length" class="text-center py-12 text-muted bg-elevated rounded-xl border border-default">
      <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
      <p>{{ $t('police.no_reports') }}</p>
    </div>
    <UTable v-else :data="sortedReports" :columns="columns">
      <template #plateNumber-cell="{ row }">
        <span dir="ltr" class="font-mono font-bold text-amber-700 dark:text-amber-400">{{ row.original.plateNumber }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge color="warning" variant="soft">{{ row.original.status }}</UBadge>
      </template>
      <template #timestamp-cell="{ row }">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted">{{ new Date(row.original.timestamp).toLocaleString($i18n.locale) }}</span>
          <UBadge
            :color="getWait(row.original.timestamp).isStale ? 'warning' : 'neutral'"
            variant="soft"
            size="xs"
          >
            {{ getWaitText(row.original.timestamp) }}
          </UBadge>
        </div>
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
import { formatWaitDuration } from '~/utils/timestamp'

const props = defineProps<{
  reports: any[]
  loading: boolean
  columns: any[]
  atCap?: boolean
}>()
defineEmits(['open'])

const { t } = useI18n()
const sortOrder = ref<'asc' | 'desc'>('asc')

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

const sortedReports = computed(() => {
  return [...(props.reports || [])].sort((a, b) => {
    const diff = (a.timestamp ?? 0) - (b.timestamp ?? 0)
    if (diff !== 0) return sortOrder.value === 'asc' ? diff : -diff
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
})

function getWait(ts: number) {
  return formatWaitDuration(ts)
}

function getWaitText(ts: number) {
  const wait = getWait(ts)
  return wait.bucket === 'just_now'
    ? t('police.wait_age.just_now')
    : t(`police.wait_age.${wait.bucket}`, { count: wait.count })
}
</script>
