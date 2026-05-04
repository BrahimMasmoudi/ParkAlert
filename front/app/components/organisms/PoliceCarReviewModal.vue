<template>
  <UModal
    v-model:open="isOpen"
    :title="modeConfig.title"
    :ui="{
      content: 'bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl overflow-hidden max-w-2xl',
      header: 'py-4 sm:py-5 border-b border-slate-800',
    }"
  >
    <template #body>
      <div v-if="car" class="space-y-6">
        <div class="bg-slate-950 rounded-xl border border-slate-800 p-5">
          <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <UIcon name="lucide:car-front" class="w-3.5 h-3.5" />
            Vehicle Details
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Plate</p>
              <p class="font-mono text-lg font-bold text-amber-400 tracking-widest">{{ car.plateNumber }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Brand & Model</p>
              <p class="text-sm text-slate-200 font-medium capitalize">{{ car.brand }} {{ car.model }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Color</p>
              <p class="text-sm text-slate-200 font-medium capitalize">{{ car.color }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Requested</p>
              <p class="text-sm text-slate-400">{{ new Date(car.createdAt).toLocaleString() }}</p>
            </div>
          </div>
        </div>

        <div v-if="mode === 'transfer'" class="bg-slate-950 rounded-xl border border-slate-800 p-5">
          <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <UIcon name="lucide:arrow-right-left" class="w-3.5 h-3.5" />
            Ownership Transfer
          </p>
          <div class="flex items-center gap-4">
            <div class="flex-1 bg-slate-900 rounded-lg p-3 border border-slate-800">
              <p class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Current Owner</p>
              <p class="text-sm font-semibold text-white">
                {{ previousOwner?.fullName || previousOwner?.name || car.ownerId }}
              </p>
              <p class="text-xs text-slate-500 mt-0.5">{{ previousOwner?.email || '—' }}</p>
            </div>

            <UIcon name="lucide:arrow-right" class="w-5 h-5 text-slate-500 shrink-0" />

            <div class="flex-1 bg-indigo-950/40 rounded-lg p-3 border border-indigo-900/50">
              <p class="text-[10px] text-indigo-400 uppercase tracking-wider mb-1">New Owner</p>
              <p class="text-sm font-semibold text-white">
                {{ newOwner?.fullName || newOwner?.name || car.transferToOwnerId || '—' }}
              </p>
              <p class="text-xs text-slate-500 mt-0.5">{{ newOwner?.email || '—' }}</p>
            </div>
          </div>
        </div>

        <div v-else class="bg-slate-950 rounded-xl border border-slate-800 p-5">
          <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <UIcon name="lucide:user" class="w-3.5 h-3.5" />
            Owner
          </p>
          <div v-if="previousOwner" class="flex items-center gap-3">
            <img
              v-if="previousOwner.photoURL"
              :src="previousOwner.photoURL"
              class="w-9 h-9 rounded-full object-cover ring-2 ring-slate-700"
            />
            <div v-else class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center ring-2 ring-slate-700">
              <UIcon name="lucide:user" class="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p class="text-sm font-semibold text-white">{{ previousOwner?.fullName || previousOwner?.name }}</p>
              <p class="text-xs text-slate-500">{{ previousOwner?.email }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-slate-400">{{ car.ownerId }}</p>
        </div>

        <div class="bg-slate-950 rounded-xl border border-slate-800 p-5">
          <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <UIcon name="lucide:file-text" class="w-3.5 h-3.5" />
            {{ mode === 'transfer' ? 'New Carte Grise' : 'Carte Grise' }}
          </p>

          <div v-if="carteGriseToShow" class="space-y-3">
            <a :href="carteGriseToShow" target="_blank" class="block group cursor-zoom-in relative">
              <img
                :src="carteGriseToShow"
                class="w-full rounded-lg border border-slate-700 object-contain max-h-64 transition-all duration-300 group-hover:brightness-75"
                @error="($event.target as HTMLImageElement).parentElement!.style.display='none'"
              />
              <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <UIcon name="i-lucide-maximize-2" class="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </a>
            <UButton
              :to="carteGriseToShow"
              target="_blank"
              color="neutral"
              variant="soft"
              icon="lucide:external-link"
              class="w-full justify-center"
            >
              Open Document in New Tab
            </UButton>
          </div>

          <div v-else class="flex items-center gap-2 text-slate-500 text-sm">
            <UIcon name="lucide:file-x" class="w-4 h-4" />
            No document uploaded
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-end w-full gap-3 pt-2">
        <UButton
          label="Close"
          color="neutral"
          variant="soft"
          size="lg"
          class="sm:flex-none justify-center"
          @click="isOpen = false"
        />
        <UButton
          label="Reject"
          color="error"
          variant="soft"
          size="lg"
          class="sm:flex-none justify-center"
          @click="emit('reject')"
        />
        <UButton
          :label="modeConfig.approvLabel"
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

const modeConfig = computed(() => {
  switch (props.mode) {
    case 'activation':
      return {
        title: 'Activation Request',
        icon: 'lucide:car',
        color: 'warning',
        approvLabel: 'Approve Registration',
        approveColor: 'success' as const,
      }
    case 'deletion':
      return {
        title: 'Deletion Request',
        icon: 'lucide:trash-2',
        color: 'error',
        approvLabel: 'Approve Deletion',
        approveColor: 'error' as const,
      }
    case 'transfer':
      return {
        title: 'Ownership Transfer Request',
        icon: 'lucide:arrow-right-left',
        color: 'primary',
        approvLabel: 'Approve Transfer',
        approveColor: 'success' as const,
      }
  }
})

const carteGriseToShow = computed(() => {
  if (!props.car) return null
  return props.car.transferCarteGriseUrl || props.car.carteGriseUrl || null
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
