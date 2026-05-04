<template>
  <USelectMenu
    v-model="selected"
    :items="items"
    searchable
    :searchable-placeholder="searchablePlaceholder || 'Search by name...'"
    :placeholder="placeholder || 'Select a user...'"
    option-attribute="label"
    class="w-full"
    size="xl"
    :ui="{ 
      base: 'bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner transition-all duration-200',
      item: { base: 'hover:bg-slate-800 transition-colors duration-150' }
    }"
  >
    <template #label>
      <div v-if="selected" class="flex items-center gap-2">
        <UAvatar :src="selected.photoURL" :alt="selected.fullName || selected.name" size="2xs" />
        <span class="truncate font-medium">{{ selected.fullName || selected.name }}</span>
        <span v-if="selected.identityNumber" class="text-[10px] text-slate-500 font-mono opacity-70">({{ selected.identityNumber }})</span>
      </div>
      <span v-else class="text-slate-500">{{ placeholder || 'Select a user...' }}</span>
    </template>

    <template #option="{ option }">
      <div class="flex items-center gap-3 py-1.5 w-full">
        <UAvatar :src="option.photoURL" :alt="option.fullName || option.name" size="sm" class="ring-1 ring-slate-800" />
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-white truncate">{{ option.fullName || option.name }}</span>
            <UBadge v-if="option.role === 'police'" color="indigo" variant="subtle" size="2xs" class="text-[8px] uppercase">Police</UBadge>
          </div>
          <div class="flex items-center gap-2 mt-0.5">
            <span v-if="option.identityNumber" class="text-[10px] text-indigo-400 font-mono tracking-tighter">{{ option.identityNumber }}</span>
            <span v-if="option.email" class="text-[10px] text-slate-500 truncate">{{ option.email }}</span>
          </div>
        </div>
      </div>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
const props = defineProps<{
  items: any[]
  placeholder?: string
  searchablePlaceholder?: string
}>()

const selected = defineModel<any | null>()
</script>
