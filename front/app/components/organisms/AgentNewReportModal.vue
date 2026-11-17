<template>
  <UModal v-model:open="isOpen" :title="$t('agent.new_report')">
    <template #body>
      <div class="flex items-center gap-2 mb-6">
        <div
          v-for="s in 3"
          :key="s"
          class="flex-1 h-1.5 rounded-full transition-colors duration-300"
          :class="s <= step ? 'bg-amber-600 dark:bg-amber-500' : 'bg-muted'"
        />
      </div>

      <div v-if="step === 1" class="space-y-4">
        <p class="font-semibold text-highlighted text-lg">{{ $t('agent.steps.photo') }}</p>
        <p class="text-xs text-muted">{{ $t('agent.form.photos_helper') }}</p>

        <div class="space-y-3">
          <div
            v-for="slotCfg in slotConfigs"
            :key="slotCfg.slot"
            class="bg-elevated border rounded-2xl p-3 space-y-2"
            :class="slotCfg.slot === 'plate' ? 'border-amber-500/70' : 'border-default'"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-semibold text-highlighted truncate">{{ slotCfg.label }}</span>
                <UBadge
                  :color="slotCfg.required ? 'warning' : 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ slotCfg.required ? $t('common.required') : $t('common.optional') }}
                </UBadge>
              </div>
              <UButton
                v-if="slotState[slotCfg.slot].preview && !slotCfg.required"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="clearSlot(slotCfg.slot)"
              />
            </div>

            <p v-if="slotCfg.reminder" class="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <UIcon name="i-lucide-alert-circle" class="w-4 h-4 shrink-0" />
              <span>{{ slotCfg.reminder }}</span>
            </p>

            <label
              class="block w-full aspect-video bg-default border-2 border-dashed border-default rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500 transition-colors overflow-hidden relative"
            >
              <img
                v-if="slotState[slotCfg.slot].preview"
                :src="slotState[slotCfg.slot].preview!"
                class="w-full h-full object-cover"
                :alt="slotCfg.label"
              >
              <div
                v-else-if="slotState[slotCfg.slot].compressing"
                class="flex flex-col items-center gap-2 text-amber-700 dark:text-amber-400"
              >
                <UIcon name="i-lucide-loader-2" class="w-7 h-7 animate-spin" />
                <span class="text-xs">{{ $t('agent.form.compressing') }}</span>
              </div>
              <template v-else>
                <UIcon name="lucide:camera" class="w-8 h-8 text-muted" />
                <span class="text-muted text-xs">{{ $t('agent.form.tap_to_photo') }}</span>
              </template>
              <input
                :id="`photo-input-${slotCfg.slot}`"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                class="hidden"
                @change="onFileChange(slotCfg.slot, $event)"
              >
            </label>

            <div v-if="slotState[slotCfg.slot].preview" class="flex justify-end">
              <label class="text-xs text-amber-700 dark:text-amber-400 hover:opacity-80 cursor-pointer font-medium">
                {{ $t('agent.form.retake_photo') }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  class="hidden"
                  @change="onFileChange(slotCfg.slot, $event)"
                >
              </label>
            </div>
          </div>
        </div>

        <UButton
          block
          size="lg"
          :disabled="!hasRequiredPhotos || isAnyCompressing"
          class="bg-amber-700 hover:bg-amber-600 text-white font-semibold"
          @click="step = 2"
        >
          {{ $t('common.next') }}
        </UButton>
      </div>

      <div v-else-if="step === 2" class="space-y-4">
        <p class="font-semibold text-highlighted text-lg">{{ $t('agent.steps.location') }}</p>

        <UButton
          id="capture-location-btn"
          block
          size="lg"
          :loading="locating"
          class="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          @click="captureLocation"
        >
          <UIcon name="lucide:crosshair" class="w-5 h-5 me-2" />
          {{ location ? $t('agent.form.recapture_gps') : $t('agent.form.capture_gps') }}
        </UButton>

        <div class="relative flex items-center py-2">
          <div class="flex-grow border-t border-default" />
          <span class="flex-shrink-0 mx-4 text-dimmed text-sm">{{ $t('common.or') }}</span>
          <div class="flex-grow border-t border-default" />
        </div>

        <UTextarea
          v-model="locationAddress"
          :placeholder="$t('agent.form.address_placeholder')"
          :rows="2"
          class="w-full"
        />

        <div class="flex gap-2">
          <UButton
            size="lg"
            variant="ghost"
            color="neutral"
            class="flex-1"
            @click="step = 1"
          >
            {{ $t('common.back') }}
          </UButton>
          <UButton
            size="lg"
            :disabled="!location && !locationAddress.trim()"
            class="flex-1 bg-amber-700 hover:bg-amber-600 text-white font-semibold"
            @click="step = 3"
          >
            {{ $t('common.next') }}
          </UButton>
        </div>
      </div>

      <div v-else-if="step === 3" class="space-y-4">
        <p class="font-semibold text-highlighted text-lg">{{ $t('agent.steps.plate') }}</p>

        <div v-if="slotState.plate.preview" class="bg-elevated border border-default rounded-xl p-2">
          <p class="text-[11px] text-amber-700 dark:text-amber-300 font-medium mb-1.5">{{ $t('agent.form.plate_preview_label') }}</p>
          <img
            :src="slotState.plate.preview"
            class="w-full max-h-40 object-contain rounded-lg bg-black"
            alt="Plate preview"
          >
        </div>

        <UInput
          id="plate-input"
          v-model="plateNumber"
          dir="ltr"
          :placeholder="$t('agent.form.plate_placeholder')"
          size="xl"
          :color="plateNumber && !isPlateValid ? 'error' : 'neutral'"
          class="text-center font-mono text-2xl uppercase tracking-widest w-full"
          autofocus
        />
        <p v-if="plateNumber && !isPlateValid" class="text-red-700 dark:text-red-400 text-sm text-center">
          {{ $t('agent.form.invalid_plate') }}
        </p>

        <div class="flex gap-2">
          <UButton
            size="lg"
            variant="ghost"
            color="neutral"
            class="flex-1"
            :disabled="uploading || reportsStore.submitting"
            @click="step = 2"
          >
            {{ $t('common.back') }}
          </UButton>
          <UButton
            id="submit-report-btn"
            size="lg"
            :loading="uploading || reportsStore.submitting"
            :disabled="!isPlateValid"
            class="flex-1 bg-amber-700 hover:bg-amber-600 text-white font-bold disabled:opacity-50"
            @click="submitReport"
          >
            {{ $t('agent.form.submit_report') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref as storageRef, uploadBytes } from 'firebase/storage'
import { useFirebaseStorage } from 'vuefire'
import type { ReportPhoto, ReportPhotoSlot } from '~/stores/reports'

interface SlotData {
  file: File | null
  preview: string | null
  compressing: boolean
}

const isOpen = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const reportsStore = useReportsStore()
const authStore = useAuthStore()
const toast = useToast()
const storage = useFirebaseStorage()
const { compressImage } = useImageCompression()
const { isFrenchPlateValid, formatFrenchPlate } = useVehicleValidation()

const step = ref(1)
const slotState = reactive<Record<ReportPhotoSlot, SlotData>>({
  context: { file: null, preview: null, compressing: false },
  plate: { file: null, preview: null, compressing: false },
  extra: { file: null, preview: null, compressing: false },
})

const location = ref<{ lat: number; lng: number } | null>(null)
const locationAddress = ref('')
const plateNumber = ref('')
const uploading = ref(false)
const locating = ref(false)

const slotConfigs = computed(() => [
  {
    slot: 'context' as ReportPhotoSlot,
    label: t('agent.form.slot_context_label'),
    required: true,
    reminder: '',
  },
  {
    slot: 'plate' as ReportPhotoSlot,
    label: t('agent.form.slot_plate_label'),
    required: true,
    reminder: t('agent.form.slot_plate_reminder'),
  },
  {
    slot: 'extra' as ReportPhotoSlot,
    label: t('agent.form.slot_extra_label'),
    required: false,
    reminder: '',
  },
])

const hasRequiredPhotos = computed(() => Boolean(slotState.context.file && slotState.plate.file))
const isAnyCompressing = computed(() =>
  slotState.context.compressing || slotState.plate.compressing || slotState.extra.compressing,
)
const isPlateValid = computed(() => isFrenchPlateValid(plateNumber.value.trim()))

watch(plateNumber, (newVal) => {
  if (newVal) plateNumber.value = formatFrenchPlate(newVal)
})

watch(isOpen, (newVal) => {
  if (newVal) resetForm()
  else revokeAllPreviews()
})

function revokeSlotPreview(slot: ReportPhotoSlot) {
  if (slotState[slot].preview) {
    URL.revokeObjectURL(slotState[slot].preview!)
    slotState[slot].preview = null
  }
}

function revokeAllPreviews() {
  revokeSlotPreview('context')
  revokeSlotPreview('plate')
  revokeSlotPreview('extra')
}

function clearSlot(slot: ReportPhotoSlot) {
  revokeSlotPreview(slot)
  slotState[slot].file = null
  slotState[slot].compressing = false
}

function resetForm() {
  step.value = 1
  clearSlot('context')
  clearSlot('plate')
  clearSlot('extra')
  location.value = null
  locationAddress.value = ''
  plateNumber.value = ''
}

async function onFileChange(slot: ReportPhotoSlot, e: Event) {
  const input = e.target as HTMLInputElement
  const rawFile = input.files?.[0]
  input.value = ''
  if (!rawFile) return

  slotState[slot].compressing = true
  try {
    const compressed = await compressImage(rawFile)
    revokeSlotPreview(slot)
    slotState[slot].file = compressed
    slotState[slot].preview = URL.createObjectURL(compressed)
  }
  catch (err: any) {
    toast.add({
      title: t('agent.form.photo_error_title'),
      description: err?.message || t('agent.form.photo_error_desc'),
      color: 'error',
    })
  }
  finally {
    slotState[slot].compressing = false
  }
}

function captureLocation() {
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      location.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      locationAddress.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
      locating.value = false
    },
    () => {
      toast.add({ title: 'Location error', description: 'Could not get your position.', color: 'error' })
      locating.value = false
    },
  )
}

async function submitReport() {
  const agentId = authStore.currentUser?.uid
  if (!agentId) {
    toast.add({ title: 'Authentication required', color: 'error' })
    return
  }
  if (!hasRequiredPhotos.value) {
    toast.add({ title: t('agent.form.photos_required_error'), color: 'error' })
    return
  }
  if (!isPlateValid.value) {
    toast.add({ title: 'Invalid plate format', description: t('agent.form.invalid_plate'), color: 'error' })
    return
  }
  if (!location.value && !locationAddress.value.trim()) {
    toast.add({ title: 'Location or address required', color: 'error' })
    return
  }

  uploading.value = true
  try {
    const draftId = crypto.randomUUID()
    const slotsToUpload: ReportPhotoSlot[] = ['context', 'plate']
    if (slotState.extra.file) slotsToUpload.push('extra')

    const uploadedPhotos: ReportPhoto[] = await Promise.all(
      slotsToUpload.map(async (slot) => {
        const file = slotState[slot].file!
        const path = `reports/${agentId}/${draftId}_${slot}_${crypto.randomUUID()}.jpg`
        const fileRef = storageRef(storage, path)
        await uploadBytes(fileRef, file, { contentType: 'image/jpeg' })
        return { path, slot }
      }),
    )

    await reportsStore.createReport({
      plateNumber: plateNumber.value.trim().toUpperCase(),
      location: location.value,
      photos: uploadedPhotos,
      address: locationAddress.value,
    })
    isOpen.value = false
  }
  finally {
    uploading.value = false
  }
}
</script>
