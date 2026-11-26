<template>
  <UContainer class="py-6">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold">{{ $t('police.disputes.title') }}</h2>
        <UBadge v-if="!loading" color="warning" variant="soft">
          {{ atCap ? '250+' : fines.length }}
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
    <div
      v-else-if="!sortedFines.length"
      class="text-center py-12 text-muted bg-elevated rounded-xl border border-default"
    >
      <UIcon name="lucide:scale" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
      <p>{{ $t('police.disputes.no_disputes') }}</p>
    </div>
    <UTable v-else :data="sortedFines" :columns="columns">
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
        <div v-if="row.original.disputedAt" class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted">
            {{ new Date(row.original.disputedAt).toLocaleString($i18n.locale) }}
          </span>
          <UBadge
            :color="getWait(row.original.disputedAt).isStale ? 'warning' : 'neutral'"
            variant="soft"
            size="xs"
          >
            {{ getWaitText(row.original.disputedAt) }}
          </UBadge>
        </div>
        <span v-else class="text-sm text-muted">-</span>
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
import { formatWaitDuration } from '~/utils/timestamp'

const props = defineProps<{
  fines: any[]
  loading: boolean
  columns: any[]
  atCap?: boolean
}>()

defineEmits(['open'])

const { t } = useI18n()
const userStore = useUserStore()
const sortOrder = ref<'asc' | 'desc'>('asc')

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

const sortedFines = computed(() => {
  return [...(props.fines || [])].sort((a, b) => {
    const diff = (a.disputedAt ?? 0) - (b.disputedAt ?? 0)
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
