<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  user?: any
}>()

const displayName = computed(() => {
  if (!props.user || props.user._loading) return 'Loading...'
  return props.user.fullName || props.user.name || 'Unknown User'
})
</script>

<template>
  <span>{{ displayName }}</span>
</template>
