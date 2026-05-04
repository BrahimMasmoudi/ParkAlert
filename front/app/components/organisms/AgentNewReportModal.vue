<template>
  <UModal v-model:open="isOpen" :title="$t('agent.new_report')" :ui="{ content: 'bg-slate-900 border border-slate-700' }">
    <template #body>
      <div class="flex items-center gap-2 mb-6">
        <div
          v-for="s in 3"
          :key="s"
          class="flex-1 h-1.5 rounded-full transition-colors duration-300"
          :class="s <= step ? 'bg-amber-500' : 'bg-slate-700'"
        />
      </div>

      <div v-if="step === 1" class="space-y-4">
        <p class="font-semibold text-white text-lg">{{ $t('agent.steps.photo') }}</p>
        <label
          class="block w-full aspect-video bg-slate-800 border-2 border-dashed border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500 transition-colors overflow-hidden"
        >
          <img v-if="photoPreview" :src="photoPreview" class="w-full h-full object-cover" alt="Preview">
          <template v-else>
            <UIcon name="lucide:camera" class="w-10 h-10 text-slate-400" />
            <span class="text-slate-400 text-sm">{{ $t('agent.form.tap_to_photo') }}</span>
          </template>
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="onFileChange"
          >
        </label>
        <UButton
          block
          size="lg"
          :disabled="!photoPreview"
          class="bg-amber-500 hover:bg-amber-400 text-white font-semibold"
          @click="step = 2"
        >
          {{ $t('common.next') }}
        </UButton>
        <UButton block size="lg" variant="ghost" class="text-slate-400" @click="step = 2">
          {{ $t('agent.form.skip_photo') }}
        </UButton>
      </div>

      <div v-else-if="step === 2" class="space-y-4">
        <p class="font-semibold text-white text-lg">{{ $t('agent.steps.location') }}</p>
        
        <UButton
          id="capture-location-btn"
          block
          size="lg"
          :loading="locating"
          class="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          @click="captureLocation"
        >
          <UIcon name="lucide:crosshair" class="w-5 h-5 mr-2" />
          {{ location ? $t('agent.form.recapture_gps') : $t('agent.form.capture_gps') }}
        </UButton>

        <div class="relative flex items-center py-2">
          <div class="flex-grow border-t border-slate-700" />
          <span class="flex-shrink-0 mx-4 text-slate-500 text-sm">{{ $t('common.or') }}</span>
          <div class="flex-grow border-t border-slate-700" />
        </div>

        <UTextarea
          v-model="locationAddress"
          :placeholder="$t('agent.form.address_placeholder')"
          :rows="2"
          class="w-full"
          :ui="{ base: 'bg-slate-800 text-white border-slate-600 focus:border-amber-500' }"
        />

        <UButton
          block
          size="lg"
          :disabled="!location && !locationAddress.trim()"
          class="bg-amber-500 hover:bg-amber-400 text-white font-semibold"
          @click="step = 3"
        >
          {{ $t('common.next') }}
        </UButton>
      </div>

      <div v-else-if="step === 3" class="space-y-4">
        <p class="font-semibold text-white text-lg">{{ $t('agent.steps.plate') }}</p>
        <UInput
          id="plate-input"
          v-model="plateNumber"
          :placeholder="$t('agent.form.plate_placeholder')"
          size="xl"
          :color="plateNumber && !isPlateValid ? 'red' : 'white'"
          class="text-center font-mono text-2xl uppercase tracking-widest"
          autofocus
        />
        <p v-if="plateNumber && !isPlateValid" class="text-red-400 text-sm text-center">
          {{ $t('agent.form.invalid_plate') }}
        </p>
        <UButton
          id="submit-report-btn"
          block
          size="lg"
          :loading="uploading || reportsStore.submitting"
          :disabled="!isPlateValid"
          class="bg-amber-500 hover:bg-amber-400 text-white font-bold disabled:opacity-50"
          @click="submitReport"
        >
          {{ $t('agent.form.submit_report') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getApp } from 'firebase/app'

const isOpen = defineModel<boolean>('open', { required: true })
const reportsStore = useReportsStore()
const authStore = useAuthStore()
const toast = useToast()

const step = ref(1)
const photoFile = ref<File | null>(null)
const photoPreview = ref<string | null>(null)
const location = ref<{ lat: number, lng: number } | null>(null)
const locationAddress = ref('')
const plateNumber = ref('')
const uploading = ref(false)
const locating = ref(false)

const { isFrenchPlateValid, formatFrenchPlate } = useVehicleValidation()

const isPlateValid = computed(() => isFrenchPlateValid(plateNumber.value.trim()))

watch(plateNumber, (newVal) => {
  if (newVal) plateNumber.value = formatFrenchPlate(newVal)
})

watch(isOpen, (newVal) => {
  if (newVal) resetForm()
})

function resetForm() {
  step.value = 1
  photoFile.value = null
  photoPreview.value = null
  location.value = null
  locationAddress.value = ''
  plateNumber.value = ''
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoFile.value = file
  photoPreview.value = URL.createObjectURL(file)
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
  if (!isPlateValid.value) {
    toast.add({ title: 'Invalid plate format', description: 'Please use a valid French plate format', color: 'error' })
    return
  }
  if (!location.value && !locationAddress.value.trim()) {
    toast.add({ title: 'Location or address required', color: 'error' })
    return
  }

  uploading.value = true
  try {
    let photoUrl = ''
    if (photoFile.value) {
      const storage = getStorage(getApp())
      const agentId = authStore.currentUser?.uid || 'anonymous'
      const path = `reports/${agentId}/${Date.now()}_${photoFile.value.name}`
      const fileRef = storageRef(storage, path)
      await uploadBytes(fileRef, photoFile.value)
      photoUrl = await getDownloadURL(fileRef)
    }

    await reportsStore.createReport({
      plateNumber: plateNumber.value.trim().toUpperCase(),
      location: location.value,
      photoUrl,
      address: locationAddress.value,
    })
    isOpen.value = false
  } finally {
    uploading.value = false
  }
}
</script>
