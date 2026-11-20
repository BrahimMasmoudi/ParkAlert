<template>
  <div class="min-h-screen bg-default flex items-center justify-center">
    <div class="flex flex-col items-center gap-4 text-muted">
      <div class="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p class="text-sm">
        Loading…
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
</script>
