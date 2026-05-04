<template>
  <div class="px-10 py-6">
    <UInput
      v-model="modelValue"
      icon="i-lucide-search"
      size="xl"
      :placeholder="placeholder || 'Search by plate number or owner name...'"
      class="max-w-md shadow-inner"
      :ui="{ base: 'bg-slate-900 border-slate-800 focus:ring-indigo-500' }"
    />
  </div>
</template>

<script setup lang="ts">
const modelValue = defineModel<string>()
defineProps<{
  placeholder?: string
}>()
</script>
