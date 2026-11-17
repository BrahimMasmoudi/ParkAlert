<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end', sideOffset: 8 }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      :aria-label="$t('common.language_aria')"
      class="flex items-center justify-center gap-1.5 px-2 min-w-[44px] min-h-[44px]"
    >
      <UIcon name="lucide:languages" class="w-4 h-4" />
      <span class="text-xs font-medium uppercase hidden sm:inline">{{ locale }}</span>
    </UButton>

    <template v-for="l in locales" :key="l.code" #[`${l.code}-trailing`]>
      <UIcon v-if="locale === l.code" name="lucide:check" class="shrink-0 size-4 text-primary" />
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

const items = computed(() => locales.value.map((l: any) => ({
  label: l.name,
  onSelect: () => setLocale(l.code),
  slot: l.code,
  class: locale.value === l.code ? 'text-primary font-semibold' : '',
})))
</script>
