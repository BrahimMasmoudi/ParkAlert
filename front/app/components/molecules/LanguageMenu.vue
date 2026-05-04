<template>
  <UDropdownMenu :items="items" :content="{ align: 'end', sideOffset: 8 }" :ui="{
    content: 'w-48 bg-slate-900 border border-slate-800 shadow-2xl rounded-xl p-1',
    item: 'flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer'
  }">
    <UButton size="sm" variant="ghost"
      class="text-slate-400 hover:text-white hover:bg-slate-800/50 flex items-center gap-2 px-2 h-9 min-w-[44px]">
      <UIcon name="lucide:languages" class="w-4 h-4" />
      <span class="text-xs font-medium uppercase hidden sm:inline">{{ locale }}</span>
    </UButton>

    <template v-for="l in locales" :key="l.code" #[`${l.code}-trailing`]>
      <UIcon v-if="locale === l.code" name="lucide:check" class="shrink-0 size-4 text-blue-400" />
    </template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { locale, locales, setLocale } = useI18n()

const items = computed(() => locales.value.map((l: any) => ({
  label: l.name,
  onSelect: () => setLocale(l.code),
  slot: l.code,
  class: locale.value === l.code ? 'text-blue-400 font-semibold' : ''
})))
</script>
