<template>
  <header class="sticky top-0 z-40 bg-default/90 backdrop-blur-lg border-b border-default">
    <UContainer class="flex items-center justify-between gap-2 py-2.5">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
          <UIcon name="lucide:shield-check" class="w-5 h-5 text-white" />
        </div>
        <div class="min-w-0">
          <p class="font-bold text-highlighted text-sm leading-none truncate">
            ParkAlert
          </p>
          <p v-if="title" class="text-muted text-xs truncate mt-0.5">
            {{ $t(title) }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <template v-if="role && cfg">
          <UDropdownMenu
            v-if="userStore.isMultiRole"
            :items="roleMenuItems"
            :content="{ align: 'end', sideOffset: 8 }"
          >
            <button
              id="role-switcher-btn"
              type="button"
              :aria-label="$t('header.switch_role')"
              :class="`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium cursor-pointer hover:brightness-110 transition-all ${cfg.color} ${cfg.bg}`"
            >
              <UIcon :name="cfg.icon" class="w-3.5 h-3.5 shrink-0" />
              <span class="capitalize hidden sm:inline">{{ $t(`roles.${role}`) }}</span>
              <UIcon name="lucide:chevrons-up-down" class="w-3 h-3 opacity-80 shrink-0" />
            </button>

            <template v-for="r in userStore.roles" :key="r" #[`${r}-trailing`]>
              <UIcon v-if="role === r" name="lucide:check" class="shrink-0 size-4 text-primary" />
            </template>
          </UDropdownMenu>

          <div
            v-else
            :class="`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.color} ${cfg.bg}`"
          >
            <UIcon :name="cfg.icon" class="w-3.5 h-3.5 shrink-0" />
            <span class="capitalize hidden sm:inline">{{ $t(`roles.${role}`) }}</span>
          </div>
        </template>

        <MoleculesColorModeMenu />
        <MoleculesLanguageMenu />

        <UButton
          id="signout-header-btn"
          color="neutral"
          variant="ghost"
          icon="lucide:log-out"
          :aria-label="$t('common.sign_out_aria')"
          class="min-w-[44px] min-h-[44px] flex items-center justify-center"
          @click="authStore.logout"
        />
      </div>
    </UContainer>
  </header>
</template>

<script setup lang="ts">
import type { UserRole } from '~/utils/roles'

const props = defineProps<{
  title?: string
  role?: UserRole
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const userStore = useUserStore()

const roleConfig: Record<UserRole, { icon: string, color: string, bg: string }> = {
  agent: {
    icon: 'lucide:camera',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/25',
  },
  police: {
    icon: 'lucide:shield',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/25',
  },
  owner: {
    icon: 'lucide:car',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/25',
  },
}

const cfg = computed(() => (props.role ? roleConfig[props.role] : undefined))

const roleMenuItems = computed(() =>
  userStore.roles.map(r => ({
    label: t(`roles.${r}`),
    icon: roleConfig[r].icon,
    slot: r,
    onSelect: () => navigateTo(`/${r}`),
    class: props.role === r ? 'text-primary font-semibold' : '',
  })),
)
</script>
