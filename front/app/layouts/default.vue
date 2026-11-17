<template>
  <div class="min-h-screen bg-default text-default relative">
    <AppHeader :title="route.meta.title" :role="route.meta.role" />
    <UContainer :class="[route.meta.containerClass || 'mx-auto', route.meta.containerPadding || 'py-6']">
      <slot />
    </UContainer>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
</script>
