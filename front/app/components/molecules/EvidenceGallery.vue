<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <p class="text-xs font-bold uppercase tracking-wider text-muted">
        {{ title || $t('police.review.evidence_photos') }}
      </p>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        :label="$t('common.refresh_photos')"
        @click="$emit('refresh')"
      />
    </div>

    <div v-if="loading" class="py-10 flex justify-center text-muted">
      <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin" />
    </div>

    <div
      v-else-if="orderedItems.length === 0"
      class="p-6 bg-elevated border border-default rounded-xl text-center text-xs text-muted"
    >
      {{ emptyMessage || $t('police.review.no_evidence') }}
    </div>

    <div v-else class="space-y-2.5">
      <div v-if="orderedItems.length > 1" class="flex flex-wrap gap-1.5">
        <UButton
          v-for="(item, idx) in orderedItems"
          :key="item.slot"
          size="xs"
          :variant="activeIndex === idx ? 'solid' : 'soft'"
          :color="activeIndex === idx ? (item.slot === 'plate' ? 'warning' : 'primary') : 'neutral'"
          :label="`${idx + 1}. ${slotTitle(item.slot)}`"
          @click="goToSlide(idx)"
        />
      </div>

      <UCarousel
        ref="carouselRef"
        v-slot="{ item }"
        :items="orderedItems"
        :arrows="orderedItems.length > 1"
        :dots="orderedItems.length > 1"
        :ui="{
          root: 'relative focus:outline-none pb-2',
          item: 'basis-full',
          prev: 'start-2 sm:start-3 top-[45%] -translate-y-1/2 bg-elevated/90 hover:bg-muted border-default text-default',
          next: 'end-2 sm:end-3 top-[45%] -translate-y-1/2 bg-elevated/90 hover:bg-muted border-default text-default',
          dots: 'relative bottom-auto inset-x-auto mt-3 flex flex-wrap items-center justify-center gap-2.5',
          dot: 'cursor-pointer size-2.5 bg-muted data-[state=active]:bg-primary rounded-full transition',
        }"
        class="w-full"
        @select="activeIndex = $event"
      >
        <div
          class="bg-default border rounded-xl overflow-hidden"
          :class="item.slot === 'plate' ? 'border-amber-500/70' : 'border-default'"
        >
          <div class="px-3 py-1.5 bg-elevated flex items-center justify-between text-xs font-semibold text-default">
            <span>{{ slotTitle(item.slot) }}</span>
            <a
              v-if="item.url && !brokenSlots[item.slot]"
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:opacity-80 flex items-center gap-1"
            >
              <UIcon name="i-lucide-maximize-2" class="w-3.5 h-3.5" />
            </a>
          </div>
          <img
            v-if="item.url && !brokenSlots[item.slot]"
            :src="item.url"
            class="w-full h-72 sm:h-80 object-contain bg-black"
            :alt="slotTitle(item.slot)"
            @error="brokenSlots[item.slot] = true"
          >
          <div
            v-else
            class="h-72 sm:h-80 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-muted"
          >
            <span>{{ $t('common.photo_unavailable') }}</span>
            <UButton
              size="xs"
              variant="soft"
              color="warning"
              :label="$t('common.refresh_photos')"
              @click="$emit('refresh')"
            />
          </div>
        </div>
      </UCarousel>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EvidenceUrlItem } from '~/composables/useDocumentViewer'
import type { ReportPhotoSlot } from '~/stores/reports'

const props = defineProps<{
  items: EvidenceUrlItem[]
  loading: boolean
  emptyMessage?: string
  title?: string
}>()

defineEmits(['refresh'])

const { t } = useI18n()
const carouselRef = ref<{ emblaApi?: { scrollTo: (index: number) => void } } | null>(null)
const activeIndex = ref(0)
const brokenSlots = ref<Record<string, boolean>>({})

watch(() => props.items, () => {
  brokenSlots.value = {}
  activeIndex.value = 0
  carouselRef.value?.emblaApi?.scrollTo(0)
})

const orderedItems = computed(() => {
  const rank: Record<ReportPhotoSlot, number> = { plate: 0, context: 1, extra: 2 }
  return [...props.items].sort((a, b) => rank[a.slot] - rank[b.slot])
})

function goToSlide(index: number) {
  activeIndex.value = index
  carouselRef.value?.emblaApi?.scrollTo(index)
}

function slotTitle(slot: ReportPhotoSlot) {
  if (slot === 'context') return t('agent.form.slot_context_label')
  if (slot === 'plate') return t('agent.form.slot_plate_label')
  return t('agent.form.slot_extra_label')
}
</script>
