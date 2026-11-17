<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end', sideOffset: 8 }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      :aria-label="$t('theme.aria_label')"
      class="min-w-[44px] min-h-[44px] flex items-center justify-center px-2"
    >
      <UIcon :name="triggerIcon" class="w-4 h-4" />
    </UButton>

    <template v-for="m in modes" :key="m.value" #[`${m.value}-trailing`]>
      <UIcon v-if="colorMode.preference === m.value" name="lucide:check" class="shrink-0 size-4 text-primary" />
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
const { t } = useI18n()

const modes = [
  { value: 'system', icon: 'lucide:monitor' },
  { value: 'light', icon: 'lucide:sun' },
  { value: 'dark', icon: 'lucide:moon' },
] as const

const triggerIcon = computed(() => {
  const match = modes.find(m => m.value === colorMode.preference)
  return match ? match.icon : 'lucide:monitor'
})

const items = computed(() => modes.map(m => ({
  label: t(`theme.${m.value}`),
  icon: m.icon,
  slot: m.value,
  class: colorMode.preference === m.value ? 'text-primary font-semibold' : '',
  onSelect: () => {
    colorMode.preference = m.value
  },
})))
</script>
