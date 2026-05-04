<template>
  <header class="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800/80">
    <UContainer class="flex items-center justify-between py-3">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
          <UIcon name="lucide:shield-check" class="w-5 h-5 text-white" />
        </div>
        <div>
          <p class="font-bold text-white text-sm leading-none">
            ParkAlert
          </p>
          <p class="text-slate-400 text-xs">
            {{ title }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div :class="`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.color} ${cfg.bg}`">
          <UIcon :name="cfg.icon" class="w-3.5 h-3.5" />
          <span class="capitalize">{{ role }}</span>
        </div>

        <UButton
          id="signout-header-btn"
          size="sm"
          variant="ghost"
          icon="lucide:log-out"
          class="text-slate-400 hover:text-white"
          @click="authStore.logout"
        />
      </div>
    </UContainer>
  </header>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  role: 'agent' | 'police' | 'owner'
}>()

const authStore = useAuthStore()

const roleConfig = {
  agent: { icon: 'lucide:camera', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  police: { icon: 'lucide:shield', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  owner: { icon: 'lucide:car', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

const cfg = computed(() => roleConfig[props.role])
</script>
