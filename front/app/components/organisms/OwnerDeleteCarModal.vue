<template>
  <UModal v-model:open="isOpen" :title="$t('owner.modals.delete_car.title')" :ui="{ content: 'bg-slate-900 border border-slate-700' }">
    <template #body>
      <div class="flex items-start gap-3">
        <div class="bg-red-500/10 p-2 rounded-full border border-red-500/20 flex-shrink-0">
          <UIcon name="lucide:alert-triangle" class="w-6 h-6 text-red-500" />
        </div>
        <div>
          <p class="text-slate-300 mt-1">
            {{ $t('owner.modals.delete_car.confirmation') }}
          </p>
          <p class="text-amber-400 text-sm mt-3 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 font-medium">
            {{ $t('owner.modals.delete_car.note') }}
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          :label="$t('common.cancel')"
          color="neutral"
          variant="ghost"
          @click="isOpen = false"
        />
        <UButton
          :label="$t('owner.modals.delete_car.confirm_button')"
          color="error"
          :loading="props.carId ? carsStore.isLoading(props.carId) : false"
          @click="confirmDelete"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useCarsStore } from '~/stores/cars'

const props = defineProps<{
  carId: string | null
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const carsStore = useCarsStore()

const confirmDelete = async () => {
  if (!props.carId) return
  await carsStore.requestDeletion(props.carId)
  isOpen.value = false
}
</script>
