<template>
  <div class="relative w-full max-w-lg pt-10 sm:pt-0">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
        <UIcon name="lucide:layers" class="w-8 h-8 text-white" />
      </div>
      <h1 class="text-3xl font-bold text-highlighted tracking-tight">
        {{ $t('select_role.title') }}
      </h1>
      <p class="text-muted mt-2 text-sm max-w-sm mx-auto">
        {{ $t('select_role.subtitle') }}
      </p>
    </div>

    <div class="space-y-3 mb-6">
      <button
        v-for="role in availableRoleCards"
        :id="`select-role-card-${role.id}`"
        :key="role.id"
        type="button"
        class="w-full min-h-[72px] text-start p-4 rounded-2xl border bg-elevated border-default transition-all duration-150 flex items-center gap-4 hover:border-primary/50 cursor-pointer"
        @click="enterWorkspace(role.id)"
      >
        <div :class="`bg-gradient-to-br ${role.gradient} p-3 rounded-xl shadow-md shrink-0`">
          <UIcon :name="role.icon" class="w-6 h-6 text-white" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-highlighted text-base">
            {{ $t(`roles.${role.id}`) }}
          </p>
          <p class="text-muted text-sm mt-0.5 truncate">
            {{ $t(`onboarding.roles.${role.id}.description`) }}
          </p>
        </div>
        <UIcon name="lucide:chevron-right" class="w-5 h-5 text-muted shrink-0" />
      </button>
    </div>

    <UButton
      id="select-role-signout-btn"
      block
      color="neutral"
      variant="ghost"
      size="sm"
      class="min-h-[44px]"
      @click="authStore.logout"
    >
      {{ $t('common.sign_out') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import type { UserRole } from '~/utils/roles'

definePageMeta({ layout: 'auth' })

const userStore = useUserStore()
const authStore = useAuthStore()

const roleDefinitions: Array<{
  id: UserRole
  icon: string
  gradient: string
}> = [
  {
    id: 'police',
    icon: 'lucide:shield',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'agent',
    icon: 'lucide:camera',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'owner',
    icon: 'lucide:car',
    gradient: 'from-emerald-500 to-teal-600',
  },
]

const availableRoleCards = computed(() =>
  roleDefinitions.filter(def => userStore.roles.includes(def.id)),
)

async function enterWorkspace(role: UserRole) {
  await navigateTo(`/${role}`)
}
</script>
