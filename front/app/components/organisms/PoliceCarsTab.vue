<template>
  <UContainer class="py-6 space-y-10">
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">{{ $t('police.cars.pending_activations') }}</h2>
        <UBadge v-if="!loading" color="warning" variant="soft">{{ activations.length }}</UBadge>
      </div>
      <LoadingSkeleton v-if="loading" :count="4" />
      <div
        v-else-if="!activations.length"
        class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800"
      >
        <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
        <p>{{ $t('police.cars.no_activations') }}</p>
      </div>
      <UTable v-else :data="activations" :columns="carColumns">
        <template #plateNumber-cell="{ row }">
          <span class="font-mono font-bold text-amber-400">{{ row.original.plateNumber }}</span>
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
        <template #createdAt-cell="{ row }">
          <span class="text-sm text-slate-400">{{ new Date(row.original.createdAt).toLocaleString() }}</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex gap-2">
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
              :loading="carsStore.isLoading(`${row.original.id}-approve`)"
              @click="carsStore.approveCar(row.original.id)"
            >{{ $t('police.actions.approve') }}</UButton>
            <UButton
              size="xs"
              color="error"
              variant="soft"
              :loading="carsStore.isLoading(`${row.original.id}-reject`)"
              @click="$emit('reject', row.original.id, false)"
            >{{ $t('common.reject') }}</UButton>
          </div>
        </template>
      </UTable>
    </section>

    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">{{ $t('police.cars.deletion_requests') }}</h2>
        <UBadge v-if="!loading" color="error" variant="soft">{{ deletions.length }}</UBadge>
      </div>
      <LoadingSkeleton v-if="loading" :count="4" />
      <div
        v-else-if="!deletions.length"
        class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800"
      >
        <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
        <p>{{ $t('police.cars.no_deletions') }}</p>
      </div>
      <UTable v-else :data="deletions" :columns="deleteColumns">
        <template #plateNumber-cell="{ row }">
          <span class="font-mono font-bold text-amber-400">{{ row.original.plateNumber }}</span>
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
        <template #createdAt-cell="{ row }">
          <span class="text-sm text-slate-400">{{ new Date(row.original.createdAt).toLocaleString() }}</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex gap-2">
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
              :loading="carsStore.isLoading(`${row.original.id}-approve`)"
              @click="carsStore.approveDeletion(row.original.id)"
            >{{ $t('police.actions.approve_deletion') }}</UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              :loading="carsStore.isLoading(`${row.original.id}-reject`)"
              @click="carsStore.approveCar(row.original.id)"
            >{{ $t('police.actions.cancel_deletion') }}</UButton>
          </div>
        </template>
      </UTable>
    </section>

    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">{{ $t('police.cars.transfer_requests') }}</h2>
        <UBadge v-if="!loading" color="primary" variant="soft">{{ transfers.length }}</UBadge>
      </div>
      <LoadingSkeleton v-if="loading" :count="4" />
      <div
        v-else-if="!transfers.length"
        class="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800"
      >
        <UIcon name="lucide:check-circle-2" class="w-8 h-8 text-slate-600 mb-2 mx-auto" />
        <p>{{ $t('police.cars.no_transfers') }}</p>
      </div>
      <UTable v-else :data="transfers" :columns="carColumns">
        <template #plateNumber-cell="{ row }">
          <span class="font-mono font-bold text-amber-400">{{ row.original.plateNumber }}</span>
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
        <template #createdAt-cell="{ row }">
          <span class="text-sm text-slate-400">{{ new Date(row.original.createdAt).toLocaleString() }}</span>
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
          <span v-else class="text-slate-500 italic text-sm">No doc</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex gap-2">
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
              :loading="carsStore.isLoading(row.original.id + '-approve')"
              @click="carsStore.approveTransfer(row.original.id)"
            >{{ $t('police.actions.approve') }}</UButton>
            <UButton
              size="xs"
              color="error"
              variant="soft"
              :loading="carsStore.isLoading(row.original.id + '-reject')"
              @click="$emit('reject', row.original.id, true)"
            >{{ $t('police.actions.reject') }}</UButton>
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

defineProps<{
  activations: any[]
  deletions: any[]
  transfers: any[]
  loading: boolean
  carColumns: any[]
  deleteColumns: any[]
}>()

defineEmits(['review', 'reject'])

const userStore = useUserStore()
const carsStore = useCarsStore()
const { openDocument, isOpening } = useDocumentViewer()
</script>
