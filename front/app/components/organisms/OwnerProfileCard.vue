<template>
  <UCard
    class="bg-elevated border border-default shadow-xl overflow-hidden relative group"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <div class="absolute top-4 end-4 z-10">
      <UTooltip :text="$t('owner.profile.edit_tooltip')">
        <UButton
          icon="lucide:edit-2"
          color="neutral"
          variant="ghost"
          class="transition-colors"
          @click="$emit('edit')"
        />
      </UTooltip>
    </div>

    <div class="p-6 bg-muted/40 border-b border-default flex flex-col items-center text-center">
      <div class="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 overflow-hidden shadow-sm">
        <img
          v-if="photoUrl"
          :src="photoUrl"
          alt="Profile"
          class="w-full h-full object-cover"
          referrerpolicy="no-referrer"
        >
        <UIcon v-else name="lucide:user-circle" class="w-8 h-8 text-primary" />
      </div>
      <h3 class="text-lg font-bold text-highlighted">{{ userProfile.fullName || userProfile.name || '—' }}</h3>
      <p class="text-sm text-muted font-mono mt-1">{{ userProfile.identityNumber || '—' }}</p>
    </div>
    <dl class="divide-y divide-default text-sm">
      <div class="flex flex-col p-4 sm:px-6">
        <dt class="text-[10px] uppercase font-bold tracking-widest text-dimmed mb-1">{{ $t('owner.profile.birth_date') }}</dt>
        <dd class="text-default font-medium">{{ userProfile.birthDate || '—' }}</dd>
      </div>
      <div class="flex flex-col p-4 sm:px-6">
        <dt class="text-[10px] uppercase font-bold tracking-widest text-dimmed mb-1">{{ $t('owner.profile.email') }}</dt>
        <dd class="text-default font-medium break-all">{{ userProfile.email || '—' }}</dd>
      </div>
      <div class="flex flex-col p-4 sm:px-6">
        <dt class="text-[10px] uppercase font-bold tracking-widest text-dimmed mb-1">{{ $t('owner.profile.phone') }}</dt>
        <dd class="text-default font-medium">{{ userProfile.phone || '—' }}</dd>
      </div>
    </dl>
  </UCard>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const photoUrl = computed(() => authStore.currentUser?.photoURL)

defineProps<{
  userProfile: {
    name?: string
    fullName?: string
    identityNumber?: string
    birthDate?: string
    email?: string
    phone?: string
  }
}>()

defineEmits<{
  (e: 'edit'): void
}>()
</script>
