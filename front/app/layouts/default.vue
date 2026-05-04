<template>
  <div class="min-h-screen bg-slate-950 text-white relative">
    <AppHeader :title="route.meta.title" :role="route.meta.role" />
    <UContainer :class="[route.meta.containerClass || 'mx-auto', route.meta.containerPadding || 'py-6']">
      <slot />
    </UContainer>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
