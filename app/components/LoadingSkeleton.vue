<script setup lang="ts">
defineProps<{ count?: number }>()
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="i in (count ?? 3)"
      :key="i"
      class="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 animate-pulse"
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-slate-700 rounded-xl flex-shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="h-4 bg-slate-700 rounded-md w-1/3" />
          <div class="h-3 bg-slate-700/60 rounded-md w-2/3" />
        </div>
      </div>
    </div>
  </div>
</template>
