<template>
  <UModal
    v-model:open="isOpen"
    :title="modeConfig.title"
    :ui="{
      content: 'max-w-2xl',
    }"
  >
    <template #body>
      <div v-if="car" class="space-y-6">
        <div class="bg-elevated rounded-xl border border-default p-5">
          <p class="text-[10px] text-dimmed font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <UIcon name="lucide:car-front" class="w-3.5 h-3.5" />
            {{ $t('police.review.vehicle_details') }}
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p class="text-[10px] text-dimmed uppercase tracking-wider mb-1">{{ $t('police.review.plate') }}</p>
              <p dir="ltr" class="font-mono text-lg font-bold text-amber-700 dark:text-amber-400 tracking-widest">{{ car.plateNumber }}</p>
            </div>
            <div>
              <p class="text-[10px] text-dimmed uppercase tracking-wider mb-1">{{ $t('police.review.brand_model') }}
              </p>
              <p class="text-sm text-default font-medium capitalize">{{ car.brand }} {{ car.model }}</p>
            </div>
            <div>
              <p class="text-[10px] text-dimmed uppercase tracking-wider mb-1">{{ $t('police.review.color') }}</p>
              <p class="text-sm text-default font-medium capitalize">{{ car.color }}</p>
            </div>
            <div>
              <p class="text-[10px] text-dimmed uppercase tracking-wider mb-1">{{ $t('police.review.requested') }}
              </p>
              <p class="text-sm text-muted">{{ new Date(car.createdAt).toLocaleString() }}</p>
            </div>
          </div>
        </div>

        <div v-if="mode === 'transfer'" class="bg-elevated rounded-xl border border-default p-5">
          <p class="text-[10px] text-dimmed font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <UIcon name="lucide:arrow-right-left" class="w-3.5 h-3.5" />
            {{ $t('police.review.ownership_transfer') }}
          </p>
          <div class="flex items-center gap-4">
            <div class="flex-1 bg-default rounded-lg p-3 border border-default">
              <p class="text-[10px] text-dimmed uppercase tracking-wider mb-1">{{ $t('police.review.current_owner')
              }}</p>
              <p class="text-sm font-semibold text-highlighted">
                {{ previousOwner?.fullName || previousOwner?.name || car.ownerId }}
              </p>
              <p class="text-xs text-muted mt-0.5">{{ previousOwner?.email || '—' }}</p>
            </div>

            <UIcon name="lucide:arrow-right" class="w-5 h-5 text-muted shrink-0 rtl:rotate-180" />

            <div class="flex-1 bg-primary/10 rounded-lg p-3 border border-primary/25">
              <p class="text-[10px] text-primary uppercase tracking-wider mb-1">{{ $t('police.review.new_owner') }}
              </p>
              <p class="text-sm font-semibold text-highlighted">
                {{ newOwner?.fullName || newOwner?.name || car.transferToOwnerId || '—' }}
              </p>
              <p class="text-xs text-muted mt-0.5">{{ newOwner?.email || '—' }}</p>
            </div>
          </div>
        </div>

        <div v-else class="bg-elevated rounded-xl border border-default p-5">
          <p class="text-[10px] text-dimmed font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <UIcon name="lucide:user" class="w-3.5 h-3.5" />
            {{ $t('police.review.owner') }}
          </p>
          <div v-if="previousOwner" class="flex items-center gap-3">
            <img
              v-if="previousOwner.photoURL"
              :src="previousOwner.photoURL"
              class="w-9 h-9 rounded-full object-cover ring-2 ring-default"
            >
            <div
              v-else
              class="w-9 h-9 rounded-full bg-muted flex items-center justify-center ring-2 ring-default"
            >
              <UIcon name="lucide:user" class="w-4 h-4 text-muted" />
            </div>
            <div>
              <p class="text-sm font-semibold text-highlighted">{{ previousOwner?.fullName || previousOwner?.name }}</p>
              <p class="text-xs text-muted">{{ previousOwner?.email }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-muted">{{ car.ownerId }}</p>
        </div>

        <div class="bg-elevated rounded-xl border border-default p-5">
          <p class="text-[10px] text-dimmed font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <UIcon name="lucide:file-text" class="w-3.5 h-3.5" />
            {{ mode === 'transfer' ? $t('police.review.new_carte_grise') : $t('police.review.carte_grise') }}
          </p>

          <div v-if="carteGriseToShow" class="space-y-3">
            <a
              v-if="resolvedDocUrl"
              :href="resolvedDocUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="block group cursor-zoom-in relative"
            >
              <img
                :src="resolvedDocUrl"
                class="w-full rounded-lg border border-default object-contain max-h-64 transition-all duration-300 group-hover:brightness-75"
                @error="($event.target as HTMLImageElement).parentElement!.style.display = 'none'"
              >
              <div
                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <UIcon name="i-lucide-maximize-2" class="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </a>
            <UButton
              color="neutral"
              variant="soft"
              icon="lucide:external-link"
              class="w-full justify-center"
              :loading="car ? isOpening(car.id, documentKind) : false"
              @click="car && openDocument(car.id, documentKind, carteGriseToShow)"
            >
              {{ $t('police.review.open_document') }}
            </UButton>
          </div>

          <div v-else class="flex items-center gap-2 text-muted text-sm">
            <UIcon name="lucide:file-x" class="w-4 h-4" />
            {{ $t('police.review.no_document') }}
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-end w-full gap-3 pt-2">
        <UButton
          :label="$t('common.close')"
          color="neutral"
          variant="soft"
          size="lg"
          class="sm:flex-none justify-center"
          @click="isOpen = false"
        />
        <UButton
          :label="$t('common.reject')"
          color="error"
          variant="soft"
          size="lg"
          class="sm:flex-none justify-center"
          @click="emit('reject')"
        />
        <UButton
          :label="$t(modeConfig.approvLabel)"
          :color="modeConfig.approveColor"
          size="lg"
          class="sm:flex-none justify-center font-bold"
          :loading="isApproving"
          @click="emit('approve')"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { useCarsStore } from '~/stores/cars'
import { useDocumentViewer } from '~/composables/useDocumentViewer'

const { t } = useI18n()
const props = defineProps<{
  car: any | null
  mode: 'activation' | 'deletion' | 'transfer'
}>()

const emit = defineEmits<{
  (e: 'approve'): void
  (e: 'reject'): void
  (e: 'close'): void
}>()

const isOpen = defineModel<boolean>('open', { required: true })
const userStore = useUserStore()
const carsStore = useCarsStore()
const { resolveDocumentUrl, openDocument, isOpening } = useDocumentViewer()

const modeConfig = computed(() => {
  switch (props.mode) {
    case 'activation':
      return {
        title: t('police.review.activation_request'),
        icon: 'lucide:car',
        color: 'warning',
        approvLabel: 'police.actions.approve_registration',
        approveColor: 'success' as const,
      }
    case 'deletion':
      return {
        title: t('police.review.deletion_request'),
        icon: 'lucide:trash-2',
        color: 'error',
        approvLabel: 'police.actions.approve_deletion',
        approveColor: 'error' as const,
      }
    case 'transfer':
      return {
        title: t('police.review.transfer_request'),
        icon: 'lucide:arrow-right-left',
        color: 'primary',
        approvLabel: 'police.actions.approve_transfer',
        approveColor: 'success' as const,
      }
    default:
      return {
        title: '',
        icon: '',
        color: 'primary',
        approvLabel: '',
        approveColor: 'primary' as const,
      }
  }
})

const carteGriseToShow = computed(() => {
  if (!props.car) return null
  return props.car.transferCarteGriseUrl || props.car.carteGriseUrl || null
})

const documentKind = computed<'active' | 'pendingTransfer'>(() =>
  props.mode === 'transfer' && props.car?.transferCarteGriseUrl ? 'pendingTransfer' : 'active'
)

const resolvedDocUrl = ref<string | null>(null)
watchEffect(async () => {
  if (!isOpen.value || !props.car?.id || !carteGriseToShow.value) {
    resolvedDocUrl.value = null
    return
  }
  try {
    resolvedDocUrl.value = await resolveDocumentUrl(
      props.car.id,
      documentKind.value,
      carteGriseToShow.value
    )
  }
  catch {
    resolvedDocUrl.value = null
  }
})

const previousOwner = computed(() =>
  props.car?.ownerId ? userStore.usersCache[props.car.ownerId] : null
)

const newOwner = computed(() =>
  props.car?.transferToOwnerId ? userStore.usersCache[props.car.transferToOwnerId] : null
)

const isApproving = computed(() =>
  props.car ? carsStore.isLoading(`${props.car.id}-approve`) || carsStore.isLoading(props.car.id) : false
)
</script>
