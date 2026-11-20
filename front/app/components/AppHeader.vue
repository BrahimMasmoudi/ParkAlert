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
          <p v-if="title" class="text-slate-400 text-xs">
            {{ $t(title) }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <template v-if="role && cfg">
          <UDropdownMenu
            v-if="userStore.isMultiRole"
            :items="roleMenuItems"
            :content="{ align: 'end', sideOffset: 8 }"
            :ui="{
              content: 'w-48 bg-slate-900 border border-slate-800 shadow-2xl rounded-xl p-1',
              item: 'flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer',
            }"
          >
            <button
              id="role-switcher-btn"
              type="button"
              :aria-label="$t('header.switch_role')"
              :class="`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium cursor-pointer hover:brightness-110 transition-all ${cfg.color} ${cfg.bg}`"
            >
              <UIcon :name="cfg.icon" class="w-3.5 h-3.5" />
              <span class="capitalize">{{ $t(`roles.${role}`) }}</span>
              <UIcon name="lucide:chevrons-up-down" class="w-3 h-3 opacity-80" />
            </button>

            <template v-for="r in userStore.roles" :key="r" #[`${r}-trailing`]>
              <UIcon v-if="role === r" name="lucide:check" class="shrink-0 size-4 text-blue-400" />
            </template>
          </UDropdownMenu>

          <div
            v-else
            :class="`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.color} ${cfg.bg}`"
          >
            <UIcon :name="cfg.icon" class="w-3.5 h-3.5" />
            <span class="capitalize">{{ $t(`roles.${role}`) }}</span>
          </div>
        </template>

        <MoleculesLanguageMenu />

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
import type { UserRole } from '~/utils/roles'

const props = defineProps<{
  title?: string
  role?: UserRole
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const userStore = useUserStore()

const roleConfig: Record<UserRole, { icon: string, color: string, bg: string }> = {
  agent: { icon: 'lucide:camera', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  police: { icon: 'lucide:shield', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  owner: { icon: 'lucide:car', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

const cfg = computed(() => (props.role ? roleConfig[props.role] : undefined))

const roleMenuItems = computed(() =>
  userStore.roles.map(r => ({
    label: t(`roles.${r}`),
    icon: roleConfig[r].icon,
    slot: r,
    onSelect: () => navigateTo(`/${r}`),
    class: props.role === r ? 'text-blue-400 font-semibold' : '',
  })),
)
</script>
