<template>
  <div class="py-6">
    <UInput
      v-model="modelValue"
      icon="i-lucide-search"
      size="xl"
      :placeholder="placeholder || $t('police.search_placeholder')"
      class="max-w-md shadow-inner w-full"
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
