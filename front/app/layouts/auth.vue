<template>
  <div
    class="min-h-screen bg-default text-default relative flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -end-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div class="absolute -bottom-40 -start-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
    </div>

    <div class="absolute top-4 end-4 z-10 flex items-center gap-1">
      <MoleculesColorModeMenu />
      <MoleculesLanguageMenu />
    </div>

    <slot />
  </div>
</template>
