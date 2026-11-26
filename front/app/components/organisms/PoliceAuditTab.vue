<template>
  <UContainer class="py-6 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-highlighted">
          {{ $t('police.audit.title') }}
        </h2>
        <p class="text-xs text-muted">
          {{ $t('police.audit.subtitle') }}
        </p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-refresh-cw"
        :label="$t('police.audit.refresh')"
        :loading="auditStore.loading"
        @click="handleRefresh"
      />
    </div>

    <!-- Category filter pills -->
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        v-for="cat in categories"
        :key="cat.value"
        size="xs"
        :color="auditStore.selectedCategory === cat.value ? 'primary' : 'neutral'"
        :variant="auditStore.selectedCategory === cat.value ? 'solid' : 'soft'"
        :label="cat.label"
        :disabled="auditStore.loading"
        @click="handleCategoryChange(cat.value)"
      />
    </div>

    <!-- Search & filter toolbar: Server Plate Search, Client Loaded-Row Filter, Explicit Receipt Lookup -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 bg-elevated p-3 rounded-xl border border-default">
      <form class="flex items-center gap-2" @submit.prevent="handlePlateSearch">
        <UInput
          v-model="plateSearchInput"
          dir="ltr"
          class="flex-1 font-mono uppercase"
          icon="i-lucide-search"
          :placeholder="$t('police.audit.plate_search_placeholder')"
        />
        <UButton
          type="submit"
          size="sm"
          color="primary"
          :label="$t('police.audit.plate_search_button')"
          :loading="auditStore.loading"
          :disabled="!plateSearchInput.trim()"
        />
        <UButton
          v-if="auditStore.plateQueryNormalized || plateSearchInput"
          type="button"
          size="sm"
          color="neutral"
          variant="ghost"
          :label="$t('police.audit.plate_clear_button')"
          :disabled="auditStore.loading"
          @click="handleClearPlate"
        />
      </form>

      <UInput
        v-model="loadedFilterQuery"
        icon="i-lucide-filter"
        :placeholder="$t('police.audit.filter_loaded_placeholder')"
      />

      <form class="flex items-center gap-2" @submit.prevent="handleReceiptLookup">
        <UInput
          v-model="receiptLookupInput"
          dir="ltr"
          class="flex-1 font-mono"
          icon="i-lucide-receipt-text"
          :placeholder="$t('police.audit.receipt_lookup_placeholder')"
        />
        <UButton
          type="submit"
          size="sm"
          color="neutral"
          variant="soft"
          :label="$t('police.audit.find_receipt_button')"
          :loading="lookingUpReceipt"
          :disabled="!receiptLookupInput.trim()"
        />
      </form>
    </div>

    <div v-if="auditStore.plateQueryNormalized" class="flex items-center gap-2 text-xs text-muted">
      <UBadge
        color="primary"
        variant="subtle"
        size="xs"
        class="font-mono"
        dir="ltr"
      >
        {{ $t('police.audit.plate_active_filter', { plate: auditStore.plateQueryNormalized }) }}
      </UBadge>
    </div>

    <UAlert
      v-if="auditStore.error"
      color="error"
      variant="subtle"
      icon="i-lucide-alert-circle"
      :description="auditStore.error"
    >
      <template #actions>
        <UButton
          size="xs"
          color="error"
          variant="soft"
          :label="$t('police.audit.retry')"
          @click="retryFailed"
        />
      </template>
    </UAlert>

    <LoadingSkeleton v-if="auditStore.loading && !auditStore.entries.length" :count="8" />

    <div
      v-else-if="!auditStore.entries.length"
      class="text-center py-12 text-muted bg-elevated rounded-xl border border-default"
    >
      <UIcon name="i-lucide-clipboard-list" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
      <p>{{ $t('police.audit.no_entries') }}</p>
    </div>

    <div
      v-else-if="!filteredEntries.length"
      class="text-center py-10 text-muted bg-elevated rounded-xl border border-default"
    >
      <UIcon name="i-lucide-filter-x" class="w-8 h-8 text-dimmed mb-2 mx-auto" />
      <p>{{ $t('police.audit.no_filtered_entries') }}</p>
    </div>

    <template v-else>
      <UTable :data="filteredEntries" :columns="columns">
        <template #timestamp-cell="{ row }">
          <span class="text-xs text-muted whitespace-nowrap">
            {{ new Date(row.original.timestamp).toLocaleString($i18n.locale) }}
          </span>
        </template>

        <template #action-cell="{ row }">
          <UBadge
            :color="actionColor(row.original.action)"
            variant="subtle"
            size="xs"
            class="font-semibold"
          >
            {{ actionLabel(row.original.action) }}
          </UBadge>
        </template>

        <template #plateNumber-cell="{ row }">
          <div v-if="row.original.plateNumber" class="space-y-0.5">
            <span dir="ltr" class="font-mono font-bold text-amber-700 dark:text-amber-400">
              {{ row.original.plateNumber }}
            </span>
            <p
              v-if="row.original.metadata?.originalPlateNumber"
              class="text-[11px] text-dimmed font-mono"
              dir="ltr"
            >
              {{ $t('police.audit.original_plate', { plate: row.original.metadata.originalPlateNumber }) }}
            </p>
          </div>
          <span v-else class="text-muted">—</span>
        </template>

        <template #actorId-cell="{ row }">
          <AtomsUserName
            :user="userStore.usersCache[row.original.actorId] || { name: row.original.actorId }"
          />
        </template>

        <template #ownerId-cell="{ row }">
          <AtomsUserName
            v-if="row.original.ownerId"
            :user="userStore.usersCache[row.original.ownerId] || { name: row.original.ownerId }"
          />
          <span v-else class="text-xs text-muted" :title="$t('police.audit.unregistered_owner')">
            —
          </span>
        </template>

        <template #reason-cell="{ row }">
          <span class="text-sm text-muted line-clamp-2 max-w-xs" :title="row.original.reason || ''">
            {{ row.original.reason || '—' }}
          </span>
        </template>

        <template #actions-cell="{ row }">
          <UButton
            v-if="row.original.targetType === 'fine' && row.original.targetId"
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-receipt-text"
            :label="$t('police.audit.view_receipt_button')"
            :loading="loadingRowReceiptId === row.original.targetId"
            @click="handleRowReceipt(row.original)"
          />
          <span v-else class="text-muted">—</span>
        </template>
      </UTable>

      <div v-if="auditStore.hasMore" class="flex justify-center pt-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-chevron-down"
          :label="$t('police.audit.load_more')"
          :loading="auditStore.loadingMore"
          @click="handleLoadMore"
        />
      </div>
    </template>

    <OrganismsPoliceReceiptModal
      v-model:open="isReceiptModalOpen"
      :fine="selectedReceiptFine"
    />
  </UContainer>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Fine } from '~/stores/fines'
import type { PoliceAuditCategory, PoliceAuditEntry } from '~/stores/policeAudit'

const props = defineProps<{
  active: boolean
}>()

const { t, te } = useI18n()
const toast = useToast()
const userStore = useUserStore()
const finesStore = useFinesStore()
const auditStore = usePoliceAuditStore()

const plateSearchInput = ref('')
const loadedFilterQuery = ref('')
const receiptLookupInput = ref('')
const lookingUpReceipt = ref(false)
const loadingRowReceiptId = ref<string | null>(null)
const isReceiptModalOpen = ref(false)
const selectedReceiptFine = ref<Fine | null>(null)
const lastFailedOp = ref<'first' | 'next'>('first')

watch(
  () => props.active,
  (isActive) => {
    if (isActive && !auditStore.hasLoaded && !auditStore.loading) {
      lastFailedOp.value = 'first'
      void auditStore.fetchFirstPage()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  auditStore.reset()
})

const categories = computed<{ value: PoliceAuditCategory, label: string }[]>(() => [
  { value: 'all', label: t('police.audit.categories.all') },
  { value: 'car', label: t('police.audit.categories.car') },
  { value: 'report', label: t('police.audit.categories.report') },
  { value: 'fine', label: t('police.audit.categories.fine') },
])

const columns = computed<TableColumn<PoliceAuditEntry>[]>(() => [
  { accessorKey: 'timestamp', header: t('police.audit.columns.timestamp') },
  { accessorKey: 'action', header: t('police.audit.columns.action') },
  { accessorKey: 'plateNumber', header: t('police.audit.columns.plate') },
  { accessorKey: 'actorId', header: t('police.audit.columns.actor') },
  { accessorKey: 'ownerId', header: t('police.audit.columns.owner') },
  { accessorKey: 'reason', header: t('police.audit.columns.reason') },
  { id: 'actions', header: t('police.audit.columns.actions') },
])

const filteredEntries = computed(() => {
  const q = loadedFilterQuery.value.trim().toLowerCase()
  if (!q) return auditStore.entries

  return auditStore.entries.filter((entry) => {
    const actor = userStore.usersCache[entry.actorId]
    const owner = entry.ownerId ? userStore.usersCache[entry.ownerId] : undefined
    const fields = [
      entry.plateNumber,
      entry.plateNumberNormalized,
      entry.action,
      actionLabel(entry.action),
      entry.reason || '',
      entry.targetId,
      entry.actorId,
      entry.ownerId,
      actor?.fullName || actor?.name || '',
      owner?.fullName || owner?.name || '',
    ]
    return fields.some(val => val.toLowerCase().includes(q))
  })
})

function actionLabel(action: string): string {
  const key = `police.audit.actions.${action}`
  return te(key) ? t(key) : action
}

function actionColor(action: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  switch (action) {
    case 'CAR_APPROVED':
    case 'TRANSFER_APPROVED':
      return 'success'
    case 'CAR_REJECTED':
    case 'TRANSFER_REJECTED':
    case 'CANCEL_FINE':
      return 'error'
    case 'CAR_DELETION_APPROVED':
    case 'DISMISS_REPORT':
      return 'neutral'
    case 'ISSUE_FINE':
    case 'DISMISS_DISPUTE':
      return 'warning'
    default:
      return 'info'
  }
}

function handleRefresh() {
  lastFailedOp.value = 'first'
  void auditStore.fetchFirstPage()
}

function handleCategoryChange(category: PoliceAuditCategory) {
  lastFailedOp.value = 'first'
  void auditStore.setCategory(category)
}

function handlePlateSearch() {
  lastFailedOp.value = 'first'
  void auditStore.searchByPlate(plateSearchInput.value)
}

function handleClearPlate() {
  plateSearchInput.value = ''
  lastFailedOp.value = 'first'
  void auditStore.clearPlateSearch()
}

function handleLoadMore() {
  lastFailedOp.value = 'next'
  void auditStore.fetchNextPage()
}

function retryFailed() {
  if (lastFailedOp.value === 'next') {
    void auditStore.fetchNextPage()
  }
  else {
    void auditStore.fetchFirstPage()
  }
}

function openFineReceiptIfPaid(fine: Fine | null) {
  if (!fine) {
    toast.add({ title: t('police.audit.receipt_not_found'), color: 'warning' })
    return
  }
  if (fine.status !== 'paid') {
    toast.add({ title: t('police.audit.receipt_not_paid'), color: 'info' })
    return
  }
  selectedReceiptFine.value = fine
  isReceiptModalOpen.value = true
}

async function handleRowReceipt(entry: PoliceAuditEntry) {
  if (!entry.targetId) return
  loadingRowReceiptId.value = entry.targetId
  try {
    const fine = await finesStore.fetchFineById(entry.targetId)
    openFineReceiptIfPaid(fine)
  }
  catch (err: unknown) {
    toast.add({
      title: t('common.error'),
      description: err instanceof Error ? err.message : t('police.audit.receipt_not_found'),
      color: 'error',
    })
  }
  finally {
    if (loadingRowReceiptId.value === entry.targetId) {
      loadingRowReceiptId.value = null
    }
  }
}

async function handleReceiptLookup() {
  const trimmed = receiptLookupInput.value.trim()
  if (!trimmed) return
  lookingUpReceipt.value = true
  try {
    let fine: Fine | null = null
    if (/^PA-/i.test(trimmed)) {
      fine = await finesStore.fetchFineByPaymentReference(trimmed)
      if (!fine) {
        fine = await finesStore.fetchFineById(trimmed)
      }
    }
    else {
      fine = await finesStore.fetchFineById(trimmed)
      if (!fine) {
        fine = await finesStore.fetchFineByPaymentReference(trimmed)
      }
    }
    openFineReceiptIfPaid(fine)
  }
  catch (err: unknown) {
    toast.add({
      title: t('common.error'),
      description: err instanceof Error ? err.message : t('police.audit.receipt_not_found'),
      color: 'error',
    })
  }
  finally {
    lookingUpReceipt.value = false
  }
}
</script>
