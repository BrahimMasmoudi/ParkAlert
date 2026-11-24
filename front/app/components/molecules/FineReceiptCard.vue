<template>
  <article
    dir="ltr"
    :lang="viewModel.locale"
    class="bg-white text-slate-900 border border-slate-200 rounded-xl shadow-sm overflow-hidden"
  >
    <!-- Header banner -->
    <header class="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-shield-check" class="w-5 h-5 text-emerald-700 shrink-0" />
          <span class="text-xl font-black tracking-tight text-slate-900">ParkAlert</span>
        </div>
        <p class="text-xs font-bold uppercase tracking-wider text-emerald-800">
          {{ copy.title }}
        </p>
        <p class="text-[11px] text-slate-600">
          {{ copy.issuedBy }}
        </p>
      </div>

      <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
        {{ viewModel.statusLabel }}
      </span>
    </header>

    <!-- Primary Reference & Total Band -->
    <div class="px-5 py-3.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-600">
          {{ copy.paymentReference }}
        </p>
        <p class="text-sm font-mono font-bold text-slate-900 mt-0.5 break-all">
          {{ viewModel.paymentReference }}
        </p>
      </div>
      <div class="text-right">
        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-600">
          {{ copy.totalPaid }}
        </p>
        <p class="text-xl font-black text-slate-900 mt-0.5">
          {{ viewModel.amountFormatted }}
        </p>
      </div>
    </div>

    <!-- Fine & Settlement Breakdown -->
    <dl class="px-5 divide-y divide-slate-200">
      <div
        v-for="row in viewModel.rows"
        :key="row.key"
        class="py-2.5 flex items-start justify-between gap-4 text-xs"
      >
        <dt class="text-slate-600 font-medium shrink-0">
          {{ row.label }}
        </dt>
        <dd
          :dir="row.isolateAuto ? 'auto' : 'ltr'"
          :style="row.isolateAuto ? 'unicode-bidi: isolate' : undefined"
          class="text-slate-900 font-semibold text-right break-words max-w-[65%]"
          :class="{ 'font-mono': row.key === 'fineReference' || row.key === 'fineId' || row.key === 'plateNumber' }"
        >
          {{ row.value }}
        </dd>
      </div>
    </dl>

    <!-- Owner-Only Card Summary Section -->
    <section
      v-if="summaryState !== undefined"
      class="px-5 py-4 border-t border-slate-200 bg-slate-50/70 space-y-2.5"
    >
      <p class="text-[10px] font-bold uppercase tracking-wider text-slate-600">
        {{ copy.cardSectionTitle }}
      </p>

      <div v-if="summaryState === 'loading' || summaryState === 'idle'" class="space-y-2" aria-busy="true">
        <div class="h-4 w-2/3 rounded bg-slate-200 animate-pulse" />
        <div class="h-4 w-1/2 rounded bg-slate-200 animate-pulse" />
      </div>

      <div
        v-else-if="summaryState === 'missing'"
        dir="auto"
        class="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2"
      >
        <UIcon name="i-lucide-info" class="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
        <span>{{ $t('owner.fines.receipt_modal.summary_missing') }}</span>
      </div>

      <div
        v-else-if="summaryState === 'error'"
        dir="auto"
        class="p-3 rounded-lg bg-red-50 border border-red-300 text-red-900 text-xs flex items-center justify-between gap-3 flex-wrap"
      >
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-alert-circle" class="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          <span>{{ $t('owner.fines.receipt_modal.summary_error') }}</span>
        </div>
        <UButton
          size="xs"
          color="error"
          variant="soft"
          icon="i-lucide-refresh-cw"
          :label="$t('owner.fines.receipt_modal.retry_button')"
          @click="emit('retry')"
        />
      </div>

      <dl v-else-if="summaryState === 'ready' && viewModel.cardSummary" class="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white px-3.5">
        <div class="py-2 flex items-start justify-between gap-4 text-xs">
          <dt class="text-slate-600 font-medium shrink-0">{{ copy.cardholder }}</dt>
          <dd
            dir="auto"
            style="unicode-bidi: isolate"
            class="text-slate-900 font-semibold text-right break-words max-w-[65%]"
          >
            {{ viewModel.cardSummary.cardholderName }}
          </dd>
        </div>
        <div class="py-2 flex items-center justify-between gap-4 text-xs">
          <dt class="text-slate-600 font-medium shrink-0">{{ copy.cardNetwork }}</dt>
          <dd class="text-slate-900 font-semibold">{{ viewModel.cardSummary.cardBrandLabel }}</dd>
        </div>
        <div class="py-2 flex items-center justify-between gap-4 text-xs">
          <dt class="text-slate-600 font-medium shrink-0">{{ copy.cardLast4 }}</dt>
          <dd class="text-slate-900 font-mono font-semibold">•••• {{ viewModel.cardSummary.cardLast4 }}</dd>
        </div>
      </dl>
    </section>

    <!-- Simulation Disclosure Footer -->
    <footer class="px-5 py-3 border-t border-slate-200 bg-slate-50 text-center">
      <p class="text-[11px] text-slate-600 italic leading-snug">
        {{ copy.simulatedFooter }}
      </p>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { FineReceiptViewModel, ReceiptCopyBlock, ReceiptSummaryState } from '~/utils/receiptPdf'

defineProps<{
  viewModel: FineReceiptViewModel
  copy: ReceiptCopyBlock
  summaryState?: ReceiptSummaryState
}>()

const emit = defineEmits<{
  (e: 'retry'): void
}>()
</script>
