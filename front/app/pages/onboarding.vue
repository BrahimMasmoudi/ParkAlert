<template>
  <div class="relative w-full max-w-lg pt-10 sm:pt-0">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
        <UIcon name="lucide:user-check" class="w-8 h-8 text-white" />
      </div>
      <h1 class="text-3xl font-bold text-highlighted tracking-tight">
        {{ $t('onboarding.welcome', { name: authStore.currentUser?.displayName?.split(' ')[0] }) }}
      </h1>
      <p class="text-muted mt-2 text-sm max-w-sm mx-auto">
        {{ $t('onboarding.subtitle') }}
      </p>
    </div>

    <div class="space-y-3 mb-6">
      <button
        v-for="role in roles"
        :id="`role-card-${role.id}`"
        :key="role.id"
        class="w-full text-start p-4 rounded-2xl border bg-elevated border-default transition-all duration-200 flex items-center gap-4 hover:border-primary/50"
        :class="selectedRole === role.id ? `ring-2 ${role.ring} scale-[1.01]` : ''"
        @click="selectedRole = role.id"
      >
        <div :class="`bg-gradient-to-br ${role.gradient} p-3 rounded-xl shadow-md flex-shrink-0`">
          <UIcon :name="role.icon" class="w-6 h-6 text-white" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-highlighted text-base">
            {{ $t(`onboarding.roles.${role.id}.label`) }}
          </p>
          <p class="text-muted text-sm mt-0.5 truncate">
            {{ $t(`onboarding.roles.${role.id}.description`) }}
          </p>
        </div>
        <Transition name="pop">
          <UIcon
            v-if="selectedRole === role.id"
            name="lucide:check-circle-2"
            class="w-5 h-5 text-primary flex-shrink-0"
          />
        </Transition>
      </button>
    </div>

    <UButton
      id="confirm-role-btn"
      block
      size="xl"
      color="primary"
      :loading="loading"
      :disabled="!selectedRole"
      class="font-semibold shadow-lg transition-all duration-200"
      @click="confirmRole"
    >
      {{ $t('onboarding.continue', { role: selectedRoleLabel }) }}
    </UButton>

    <UButton
      id="signout-btn"
      block
      color="neutral"
      variant="ghost"
      size="sm"
      class="mt-4"
      @click="authStore.logout"
    >
      {{ $t('common.sign_out') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const userStore = useUserStore()
const authStore = useAuthStore()

const selectedRole = ref<'agent' | 'police' | 'owner' | null>(null)
const loading = ref(false)

const roles = [
  {
    id: 'agent' as const,
    icon: 'lucide:camera',
    gradient: 'from-amber-500 to-orange-600',
    ring: 'ring-amber-500',
  },
  {
    id: 'police' as const,
    icon: 'lucide:shield',
    gradient: 'from-blue-500 to-indigo-600',
    ring: 'ring-blue-500',
  },
  {
    id: 'owner' as const,
    icon: 'lucide:car',
    gradient: 'from-emerald-500 to-teal-600',
    ring: 'ring-emerald-500',
  },
]

const selectedRoleLabel = computed(
  () => selectedRole.value ? t(`onboarding.roles.${selectedRole.value}.label`) : '...',
)

async function confirmRole() {
  if (!selectedRole.value) return
  loading.value = true
  try {
    await userStore.setRole(selectedRole.value)
  }
  finally {
    loading.value = false
  }
}
</script>

<style scoped>
.pop-enter-active { transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1); }
.pop-enter-from  { opacity: 0; transform: scale(0.5); }
</style>
