export default defineNuxtPlugin((nuxtApp) => {
  // Access i18n from nuxtApp
  const { $i18n } = nuxtApp

  // Watch for locale changes to update document direction
  if (import.meta.client) {
    watch(() => $i18n.locale.value, (newLocale) => {
      const localeProperties = $i18n.locales.value.find(l => l.code === newLocale)
      if (localeProperties && localeProperties.dir) {
        document.documentElement.dir = localeProperties.dir
      } else {
        document.documentElement.dir = 'ltr'
      }
    }, { immediate: true })
  }
})
