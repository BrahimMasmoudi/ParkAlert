<template>
  <section class="space-y-8">
    <div>
      <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <div>
          <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <UIcon name="lucide:car" class="w-5 h-5 text-indigo-400" />
            {{ $t('owner.vehicles.title') }}
          </h2>
          <p class="text-sm text-slate-400 mt-1">{{ $t('owner.vehicles.subtitle') }}</p>
        </div>
        <UButton
          icon="lucide:plus"
          :label="$t('owner.vehicles.add_button')"
          color="primary"
          size="md"
          class="hidden sm:flex shadow-md shadow-indigo-500/20"
          @click="$emit('add')"
        />
      </div>

      <LoadingSkeleton v-if="loading" :count="2" class="h-48 mb-4" />

      <div
        v-else-if="!cars?.length"
        class="flex flex-col items-center justify-center py-20 bg-slate-900 border border-slate-800 border-dashed rounded-2xl"
      >
        <div class="p-4 bg-slate-800 rounded-full mb-4">
          <UIcon name="lucide:car-front" class="w-8 h-8 text-slate-400" />
        </div>
        <p class="text-lg text-white font-bold tracking-tight">{{ $t('owner.vehicles.no_vehicles') }}</p>
        <p class="text-slate-400 text-sm mt-2 max-w-sm text-center">{{ $t('owner.vehicles.empty_state_desc') }}</p>
        <UButton
          icon="lucide:plus"
          :label="$t('owner.vehicles.register_button')"
          color="primary"
          size="lg"
          class="mt-6 sm:hidden"
          @click="$emit('add')"
        />
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <MoleculesOwnerCarCard
          v-for="car in cars"
          :key="car.id"
          :car="car"
          @delete="$emit('delete', car.id)"
          @retry="$emit('retry', car.id)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  cars: any[]
  loading: boolean
}>()

defineEmits(['add', 'delete', 'retry'])
</script>
