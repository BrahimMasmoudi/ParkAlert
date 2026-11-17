<template>
  <div class="py-6">
    <UInput
      v-model="modelValue"
      icon="i-lucide-search"
      size="xl"
      :placeholder="placeholder || $t('police.search_placeholder')"
      class="max-w-md w-full"
    />
  </div>
</template>

<script setup lang="ts">
const modelValue = defineModel<string>()
defineProps<{
  placeholder?: string
}>()
</script>
