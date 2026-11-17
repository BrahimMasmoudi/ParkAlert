<template>
  <div>
    <UApp :locale="uiLocale">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </div>
</template>

<script setup lang="ts">
import { ar, en, fr } from '@nuxt/ui/locale'

const { locale } = useI18n()

const uiLocales = { en, fr, ar } as const
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales] ?? fr)
</script>