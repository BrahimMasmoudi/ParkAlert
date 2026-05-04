<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
    </div>

    <div class="relative w-full max-w-lg">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
          <UIcon name="lucide:user-check" class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-3xl font-bold text-white tracking-tight">
          Welcome, {{ authStore.currentUser?.displayName?.split(' ')[0] }}
        </h1>
        <p class="text-slate-400 mt-2 text-sm max-w-sm mx-auto">
          Select your role to access your personalised dashboard.
        </p>
      </div>

      <div class="space-y-3 mb-6">
        <button
          v-for="role in roles"
          :id="`role-card-${role.id}`"
          :key="role.id"
          class="w-full text-left p-4 rounded-2xl border backdrop-blur-sm transition-all duration-200 flex items-center gap-4"
          :class="[
            role.bg,
            selectedRole === role.id
              ? `ring-2 ${role.ring} scale-[1.01]`
              : 'hover:scale-[1.005] hover:brightness-110',
          ]"
          @click="selectedRole = role.id"
        >
          <div :class="`bg-gradient-to-br ${role.gradient} p-3 rounded-xl shadow-md flex-shrink-0`">
            <UIcon :name="role.icon" class="w-6 h-6 text-white" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-white text-base">
              {{ role.label }}
            </p>
            <p class="text-slate-400 text-sm mt-0.5 truncate">
              {{ role.description }}
            </p>
          </div>
          <Transition name="pop">
            <UIcon
              v-if="selectedRole === role.id"
              name="lucide:check-circle-2"
              class="w-5 h-5 text-white flex-shrink-0"
            />
          </Transition>
        </button>
      </div>

      <UButton
        id="confirm-role-btn"
        block
        size="xl"
        :loading="loading"
        :disabled="!selectedRole"
        class="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/25 transition-all duration-200 disabled:opacity-40"
        @click="confirmRole"
      >
        Continue as {{ selectedRoleLabel }}
      </UButton>

      <button
        id="signout-btn"
        class="mt-4 w-full text-slate-500 hover:text-slate-300 text-sm text-center transition-colors py-2"
        @click="authStore.logout"
      >
        Sign out
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const userStore = useUserStore()
const authStore = useAuthStore()
const router = useRouter()

const selectedRole = ref<'agent' | 'police' | 'owner' | null>(null)
const loading = ref(false)

const roles = [
  {
    id: 'agent' as const,
    label: 'Parking Agent',
    description: 'File reports on illegally parked vehicles in the field.',
    icon: 'lucide:camera',
    gradient: 'from-amber-500 to-orange-600',
    ring: 'ring-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'police' as const,
    label: 'Police Officer',
    description: 'Investigate reports and issue fines to vehicle owners.',
    icon: 'lucide:shield',
    gradient: 'from-blue-500 to-indigo-600',
    ring: 'ring-blue-500',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'owner' as const,
    label: 'Car Owner',
    description: 'View your vehicle\'s status and manage any outstanding fines.',
    icon: 'lucide:car',
    gradient: 'from-emerald-500 to-teal-600',
    ring: 'ring-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
]

const selectedRoleLabel = computed(
  () => roles.find(r => r.id === selectedRole.value)?.label ?? '...',
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
