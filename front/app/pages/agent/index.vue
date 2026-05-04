<template>
  <div class="grid grid-cols-2 gap-3 mb-6">
    <UCard class="bg-amber-500/10 border border-amber-500/20 text-center p-4">
      <p class="text-3xl font-bold text-amber-400">
        {{reportsStore.agentReportsTodayCount}}
      </p>
      <p class="text-slate-400 text-xs mt-1">
        {{ $t('agent.reports_today') }}
      </p>
    </UCard>
    <UCard class="bg-slate-800/60 border border-slate-700/50 text-center p-4">
      <p class="text-3xl font-bold text-white">
        {{reportsStore.agentTotalReportsCount}}
      </p>
      <p class="text-slate-400 text-xs mt-1">
        {{ $t('agent.total_reports') }}
      </p>
    </UCard>
  </div>

  <button
    id="new-report-btn"
    class="w-full bg-gradient-to-br from-amber-500 to-orange-600 hover:brightness-110 active:scale-95 text-white rounded-3xl py-8 flex flex-col items-center gap-3 shadow-2xl shadow-amber-600/30 transition-all duration-200 mb-6"
    @click="isOpen = true"
  >
    <UIcon name="lucide:camera" class="w-12 h-12" />
    <span class="text-xl font-bold tracking-tight">{{ $t('agent.new_report') }}</span>
    <span class="text-amber-200 text-sm">{{ $t('agent.new_report_subtitle') }}</span>
  </button>

  <p class="text-slate-500 text-sm text-center">
    {{ $t('agent.footer_info') }}
  </p>

  <OrganismsAgentNewReportModal v-model:open="isOpen" />
</template>

<script setup lang="ts">
const { t } = useI18n()

definePageMeta({ 
  ssr: false,
  title: 'agent.title',
  role: 'agent',
  containerClass: 'max-w-lg'
})

const reportsStore = useReportsStore()
const isOpen = ref(false)
</script>