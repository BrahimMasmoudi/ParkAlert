<template>
  <UContainer class="py-6 space-y-10">
    <div class="flex justify-end">
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

    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">{{ $t('police.cars.pending_activations') }}</h2>
        <UBadge v-if="!loading" color="warning" variant="soft">{{ sortedActivations.length }}</UBadge>
      </div>
      <LoadingSkeleton v-if="loading" :count="4" />
      <div
        v-else-if="!sortedActivations.length"
        class="text-center py-12 text-muted bg-elevated rounded-xl border border-default"
      >
        <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
        <p>{{ $t('police.cars.no_activations') }}</p>
      </div>
      <UTable v-else :data="sortedActivations" :columns="carColumns">
        <template #plateNumber-cell="{ row }">
          <span dir="ltr" class="font-mono font-bold text-amber-700 dark:text-amber-400">{{ row.original.plateNumber }}</span>
        </template>
        <template #vehicle-cell="{ row }">
          {{ row.original.brand }} {{ row.original.model }}
        </template>
        <template #ownerId-cell="{ row }">
          <AtomsUserName :user="userStore.usersCache[row.original.ownerId]" />
        </template>
        <template #status-cell="{ row }">
          <UBadge color="warning" variant="soft">{{ row.original.status.replace(/_/g, ' ') }}</UBadge>
        </template>
        <template #requestedAt-cell="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted">{{ formatDate(getCarQueueTimestamp(row.original, 'activation')) }}</span>
            <UBadge
              :color="getWait(getCarQueueTimestamp(row.original, 'activation')).isStale ? 'warning' : 'neutral'"
              variant="soft"
              size="xs"
            >
              {{ getWaitText(getCarQueueTimestamp(row.original, 'activation')) }}
            </UBadge>
          </div>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="lucide:eye"
              @click="$emit('review', row.original, 'activation')"
            >{{ $t('common.details') }}</UButton>
            <UButton
              size="xs"
              color="success"
              :disabled="isSelfOwned(row.original)"
              :loading="carsStore.isLoading(`${row.original.id}-approve`)"
              @click="carsStore.approveCar(row.original.id)"
            >{{ $t('police.actions.approve') }}</UButton>
            <UButton
              size="xs"
              color="error"
              variant="soft"
              :disabled="isSelfOwned(row.original)"
              :loading="carsStore.isLoading(`${row.original.id}-reject`)"
              @click="$emit('reject', row.original.id, false)"
            >{{ $t('common.reject') }}</UButton>
            <UBadge
              v-if="isSelfOwned(row.original)"
              color="warning"
              variant="soft"
              size="xs"
            >
              {{ $t('police.self_enforcement_notice') }}
            </UBadge>
          </div>
        </template>
      </UTable>
    </section>

    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">{{ $t('police.cars.deletion_requests') }}</h2>
        <UBadge v-if="!loading" color="error" variant="soft">{{ sortedDeletions.length }}</UBadge>
      </div>
      <LoadingSkeleton v-if="loading" :count="4" />
      <div
        v-else-if="!sortedDeletions.length"
        class="text-center py-12 text-muted bg-elevated rounded-xl border border-default"
      >
        <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
        <p>{{ $t('police.cars.no_deletions') }}</p>
      </div>
      <UTable v-else :data="sortedDeletions" :columns="deleteColumns">
        <template #plateNumber-cell="{ row }">
          <span dir="ltr" class="font-mono font-bold text-amber-700 dark:text-amber-400">{{ row.original.plateNumber }}</span>
        </template>
        <template #vehicle-cell="{ row }">
          {{ row.original.brand }} {{ row.original.model }}
        </template>
        <template #ownerId-cell="{ row }">
          <AtomsUserName :user="userStore.usersCache[row.original.ownerId]" />
        </template>
        <template #status-cell>
          <UBadge color="error" variant="soft">{{ $t('police.cars.status.deletion_requested') }}</UBadge>
        </template>
        <template #requestedAt-cell="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted">{{ formatDate(getCarQueueTimestamp(row.original, 'deletion')) }}</span>
            <UBadge
              :color="getWait(getCarQueueTimestamp(row.original, 'deletion')).isStale ? 'warning' : 'neutral'"
              variant="soft"
              size="xs"
            >
              {{ getWaitText(getCarQueueTimestamp(row.original, 'deletion')) }}
            </UBadge>
          </div>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="lucide:eye"
              @click="$emit('review', row.original, 'deletion')"
            >{{ $t('common.details') }}</UButton>
            <UButton
              size="xs"
              color="error"
              :disabled="isSelfOwned(row.original)"
              :loading="carsStore.isLoading(`${row.original.id}-approve`)"
              @click="carsStore.approveDeletion(row.original.id)"
            >{{ $t('police.actions.approve_deletion') }}</UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              :disabled="isSelfOwned(row.original)"
              :loading="carsStore.isLoading(`${row.original.id}-reject`)"
              @click="carsStore.approveCar(row.original.id)"
            >{{ $t('police.actions.cancel_deletion') }}</UButton>
            <UBadge
              v-if="isSelfOwned(row.original)"
              color="warning"
              variant="soft"
              size="xs"
            >
              {{ $t('police.self_enforcement_notice') }}
            </UBadge>
          </div>
        </template>
      </UTable>
    </section>

    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">{{ $t('police.cars.transfer_requests') }}</h2>
        <UBadge v-if="!loading" color="primary" variant="soft">{{ sortedTransfers.length }}</UBadge>
      </div>
      <LoadingSkeleton v-if="loading" :count="4" />
      <div
        v-else-if="!sortedTransfers.length"
        class="text-center py-12 text-muted bg-elevated rounded-xl border border-default"
      >
        <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
        <p>{{ $t('police.cars.no_transfers') }}</p>
      </div>
      <UTable v-else :data="sortedTransfers" :columns="carColumns">
        <template #plateNumber-cell="{ row }">
          <span dir="ltr" class="font-mono font-bold text-amber-700 dark:text-amber-400">{{ row.original.plateNumber }}</span>
        </template>
        <template #vehicle-cell="{ row }">
          {{ row.original.brand }} {{ row.original.model }}
        </template>
        <template #ownerId-cell="{ row }">
          <AtomsUserName :user="userStore.usersCache[row.original.ownerId]" />
        </template>
        <template #status-cell="{ row }">
          <UBadge color="primary" variant="soft">{{ $t(`police.cars.status.${row.original.status}`) }}</UBadge>
        </template>
        <template #requestedAt-cell="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-muted">{{ formatDate(getCarQueueTimestamp(row.original, 'transfer')) }}</span>
            <UBadge
              :color="getWait(getCarQueueTimestamp(row.original, 'transfer')).isStale ? 'warning' : 'neutral'"
              variant="soft"
              size="xs"
            >
              {{ getWaitText(getCarQueueTimestamp(row.original, 'transfer')) }}
            </UBadge>
          </div>
        </template>
        <template #carteGriseUrl-cell="{ row }">
          <UButton
            v-if="row.original.transferCarteGriseUrl || row.original.carteGriseUrl"
            size="xs"
            color="neutral"
            variant="soft"
            icon="lucide:external-link"
            :loading="isOpening(row.original.id, row.original.transferCarteGriseUrl ? 'pendingTransfer' : 'active')"
            @click="openDocument(row.original.id, row.original.transferCarteGriseUrl ? 'pendingTransfer' : 'active', row.original.transferCarteGriseUrl || row.original.carteGriseUrl)"
          >
            {{ $t('common.view_document') }}
          </UButton>
          <span v-else class="text-muted italic text-sm">No doc</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="lucide:eye"
              @click="$emit('review', row.original, 'transfer')"
            >{{ $t('common.details') }}</UButton>
            <UButton
              size="xs"
              color="success"
              :disabled="isSelfOwned(row.original)"
              :loading="carsStore.isLoading(row.original.id + '-approve')"
              @click="carsStore.approveTransfer(row.original.id)"
            >{{ $t('police.actions.approve') }}</UButton>
            <UButton
              size="xs"
              color="error"
              variant="soft"
              :disabled="isSelfOwned(row.original)"
              :loading="carsStore.isLoading(row.original.id + '-reject')"
              @click="$emit('reject', row.original.id, true)"
            >{{ $t('police.actions.reject') }}</UButton>
            <UBadge
              v-if="isSelfOwned(row.original)"
              color="warning"
              variant="soft"
              size="xs"
            >
              {{ $t('police.self_enforcement_notice') }}
            </UBadge>
          </div>
        </template>
      </UTable>
    </section>
  </UContainer>
</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { useCarsStore } from '~/stores/cars'
import { useDocumentViewer } from '~/composables/useDocumentViewer'
import { formatWaitDuration, getCarQueueTimestamp, type CarQueueType } from '~/utils/timestamp'

const props = defineProps<{
  activations: any[]
  deletions: any[]
  transfers: any[]
  loading: boolean
  carColumns: any[]
  deleteColumns: any[]
}>()

defineEmits(['review', 'reject'])

const { t, locale } = useI18n()
const authStore = useAuthStore()
const userStore = useUserStore()
const carsStore = useCarsStore()
const { openDocument, isOpening } = useDocumentViewer()

const sortOrder = ref<'asc' | 'desc'>('asc')

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

function sortQueue(items: any[], queue: CarQueueType) {
  return [...(items || [])].sort((a, b) => {
    const diff = getCarQueueTimestamp(a, queue) - getCarQueueTimestamp(b, queue)
    if (diff !== 0) return sortOrder.value === 'asc' ? diff : -diff
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}

const sortedActivations = computed(() => sortQueue(props.activations, 'activation'))
const sortedDeletions = computed(() => sortQueue(props.deletions, 'deletion'))
const sortedTransfers = computed(() => sortQueue(props.transfers, 'transfer'))

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(locale.value)
}

function getWait(ts: number) {
  return formatWaitDuration(ts)
}

function getWaitText(ts: number) {
  const wait = getWait(ts)
  return wait.bucket === 'just_now'
    ? t('police.wait_age.just_now')
    : t(`police.wait_age.${wait.bucket}`, { count: wait.count })
}

function isSelfOwned(car: any) {
  const uid = authStore.currentUser?.uid
  return Boolean(uid && car && (car.ownerId === uid || car.transferToOwnerId === uid))
}
</script>
