<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <AppHeader title="Agent Dashboard" role="agent" />

    <UContainer class="py-6 max-w-lg mx-auto">
      <!-- Stats strip -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <UCard class="bg-amber-500/10 border border-amber-500/20 text-center p-4">
          <p class="text-3xl font-bold text-amber-400">
            {{reportsStore.agentReportsTodayCount}}
          </p>
          <p class="text-slate-400 text-xs mt-1">
            Reports Today
          </p>
        </UCard>
        <UCard class="bg-slate-800/60 border border-slate-700/50 text-center p-4">
          <p class="text-3xl font-bold text-white">
            {{reportsStore.agentTotalReportsCount}}
          </p>
          <p class="text-slate-400 text-xs mt-1">
            Total Reports
          </p>
        </UCard>
      </div>

      <!-- Primary action -->
      <button
        id="new-report-btn"
        class="w-full bg-gradient-to-br from-amber-500 to-orange-600 hover:brightness-110 active:scale-95 text-white rounded-3xl py-8 flex flex-col items-center gap-3 shadow-2xl shadow-amber-600/30 transition-all duration-200 mb-6"
        @click="openModal"
      >
        <UIcon name="lucide:camera" class="w-12 h-12" />
        <span class="text-xl font-bold tracking-tight">New Report</span>
        <span class="text-amber-200 text-sm">Tap to report an illegally parked vehicle</span>
      </button>

      <!-- Recent hint -->
      <p class="text-slate-500 text-sm text-center">
        Your submitted reports are processed by police officers.
      </p>
    </UContainer>

    <!-- ── Report Modal ────────────────────────────────────────────────────── -->
    <UModal v-model:open="isOpen" title="New Report" :ui="{ content: 'bg-slate-900 border border-slate-700' }">
      <template #body>
        <!-- Step indicators -->
        <div class="flex items-center gap-2 mb-6">
          <div
            v-for="s in 3"
            :key="s"
            class="flex-1 h-1.5 rounded-full transition-colors duration-300"
            :class="s <= step ? 'bg-amber-500' : 'bg-slate-700'"
          />
        </div>

        <!-- Step 1: Photo -->
        <div v-if="step === 1" class="space-y-4">
          <p class="font-semibold text-white text-lg">
            Step 1 — Take a Photo
          </p>
          <label
            class="block w-full aspect-video bg-slate-800 border-2 border-dashed border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500 transition-colors overflow-hidden"
          >
            <img v-if="photoPreview" :src="photoPreview" class="w-full h-full object-cover" alt="Preview">
            <template v-else>
              <UIcon name="lucide:camera" class="w-10 h-10 text-slate-400" />
              <span class="text-slate-400 text-sm">Tap to take / upload photo</span>
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
            Next
          </UButton>
          <UButton block size="lg" variant="ghost" class="text-slate-400" @click="step = 2">
            Skip photo
          </UButton>
        </div>

        <!-- Step 2: Location -->
        <div v-else-if="step === 2" class="space-y-4">
          <p class="font-semibold text-white text-lg">
            Step 2 — Capture Location
          </p>
          
          <UButton
            id="capture-location-btn"
            block
            size="lg"
            :loading="locating"
            class="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            @click="captureLocation"
          >
            <UIcon name="lucide:crosshair" class="w-5 h-5 mr-2" />
            {{ location ? 'Re-capture Location' : 'Capture My Location (GPS)' }}
          </UButton>

          <div class="relative flex items-center py-2">
            <div class="flex-grow border-t border-slate-700" />
            <span class="flex-shrink-0 mx-4 text-slate-500 text-sm">OR</span>
            <div class="flex-grow border-t border-slate-700" />
          </div>

          <UTextarea
            v-model="locationAddress"
            placeholder="Write down the exact address or coordinates"
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
            Next
          </UButton>
        </div>

        <!-- Step 3: Plate -->
        <div v-else-if="step === 3" class="space-y-4">
          <p class="font-semibold text-white text-lg">
            Step 3 — Enter Plate Number
          </p>
          <UInput
            id="plate-input"
            v-model="plateNumber"
            placeholder="e.g. AB-123-CD"
            size="xl"
            :color="plateNumber && !isPlateValid ? 'red' : 'white'"
            class="text-center font-mono text-2xl uppercase tracking-widest"
            autofocus
          />
          <p v-if="plateNumber && !isPlateValid" class="text-red-400 text-sm text-center">
            Invalid format. Please use a valid French plate (e.g., AB-123-CD)
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
            Submit Report
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
<script setup lang="ts">
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getApp } from 'firebase/app'

definePageMeta({ ssr: false })

const reportsStore = useReportsStore()
const authStore = useAuthStore()
const toast = useToast()

// ── Report modal ──────────────────────────────────────────────────────────────
const isOpen = ref(false)
const step = ref(1) // 1=photo, 2=location, 3=plate

const photoFile = ref<File | null>(null)
const photoPreview = ref<string | null>(null)
const location = ref<{ lat: number, lng: number } | null>(null)
const locationAddress = ref('')
const plateNumber = ref('')
const uploading = ref(false)

const isPlateValid = computed(() => {
  const plate = plateNumber.value.trim()
  if (!plate) return false
  // Matches modern SIV (AB-123-CD) and older FNI (1234 AB 56) formats
  const frenchPlateRegex = /^([A-Z]{2}[-\s]?\d{3}[-\s]?[A-Z]{2}|\d{1,4}[-\s]?[A-Z]{2,3}[-\s]?\d{2,3})$/i
  return frenchPlateRegex.test(plate)
})

function resetForm() {
  step.value = 1
  photoFile.value = null
  photoPreview.value = null
  location.value = null
  locationAddress.value = ''
  plateNumber.value = ''
}

function openModal() {
  resetForm()
  isOpen.value = true
}

// Step 1 — Photo
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoFile.value = file
  photoPreview.value = URL.createObjectURL(file)
}

// Step 2 — Location
const locating = ref(false)
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

// Step 3 — Submit
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
  }
  finally {
    uploading.value = false
  }
}
</script>