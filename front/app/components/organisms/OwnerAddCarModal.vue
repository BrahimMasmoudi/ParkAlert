<script setup lang="ts">
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useFirebaseStorage } from 'vuefire'
import { useCarsStore } from '~/stores/cars'
import { useUserStore } from '~/stores/user'
import { storeToRefs } from 'pinia'

const isOpen = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  carToEdit?: any | null
}>()

const userStore = useUserStore()
const carsStore = useCarsStore()
const { userProfile } = storeToRefs(userStore)
const storage = useFirebaseStorage()
const toast = useToast()

const formState = ref({
  plateNumber: '',
  brand: '',
  model: '',
  color: '',
})
const selectedFile = ref<File | null>(null)
const uploadLoading = ref(false)

watch(() => isOpen.value, (newVal) => {
  if (newVal && props.carToEdit) {
    formState.value = {
      plateNumber: props.carToEdit.plateNumber,
      brand: props.carToEdit.brand,
      model: props.carToEdit.model,
      color: props.carToEdit.color,
    }
    selectedFile.value = null
  } else if (newVal) {
    formState.value = {
      plateNumber: '',
      brand: '',
      model: '',
      color: '',
    }
    selectedFile.value = null
  }
})

const { isFrenchPlateValid, formatFrenchPlate } = useVehicleValidation()

const isPlateValid = computed(() => isFrenchPlateValid(formState.value.plateNumber))

watch(() => formState.value.plateNumber, (newVal) => {
  if (newVal) {
    formState.value.plateNumber = formatFrenchPlate(newVal)
  }
})

const plateError = computed(() => {
  if (formState.value.plateNumber && !isPlateValid.value) {
    return 'Invalid French plate format (e.g. AB-123-CD)'
  }
  return undefined
})

const isFormValid = computed(() => {
  return isPlateValid.value && 
         formState.value.brand.trim() !== '' && 
         formState.value.model.trim() !== '' && 
         formState.value.color.trim() !== '' && 
         selectedFile.value !== null
})

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files?.length) {
    selectedFile.value = target.files[0]
  }
}

const submitAddCar = async () => {
  if (!isFormValid.value) {
    if (formState.value.plateNumber && !isPlateValid.value) {
      toast.add({ title: 'Invalid Plate Number', description: 'Please enter a valid French license plate.', color: 'error' })
    } else if (!selectedFile.value) {
      toast.add({ title: 'Missing Document', description: 'Please upload Carte Grise.', color: 'error' })
    } else {
      toast.add({ title: 'Incomplete Form', description: 'Please fill all required fields.', color: 'error' })
    }
    return
  }

  uploadLoading.value = true
  try {
    const fileRef = storageRef(storage, `carteGrise/${userProfile.value?.uid}/${Date.now()}_${selectedFile.value.name}`)
    const snapshot = await uploadBytes(fileRef, selectedFile.value)
    const url = await getDownloadURL(snapshot.ref)
    
    if (props.carToEdit) {
      await carsStore.retryCar({
        carId: props.carToEdit.id,
        ...formState.value,
        carteGriseUrl: url
      })
    } else {
      await carsStore.addCar({
        ...formState.value,
        carteGriseUrl: url
      })
    }
    
    isOpen.value = false
    formState.value = {
      plateNumber: '',
      brand: '',
      model: '',
      color: '',
    }
    selectedFile.value = null
  } catch (error: any) {
    toast.add({ title: 'Upload failed', description: error.message, color: 'error' })
  } finally {
    uploadLoading.value = false
  }
}
</script>

<template>
  <UModal 
    v-model:open="isOpen" 
    prevent-close 
    :title="carToEdit ? 'Resubmit Vehicle Registration' : 'Register New Vehicle'"
    :description="carToEdit ? 'Update your vehicle details to retry activation.' : 'Official vehicle registration for parking enforcement.'"
    :ui="{ 
      content: 'bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-2xl overflow-hidden',
      header: 'py-4 sm:py-5 border-b border-slate-800'
    }"
  >

    <template #body>
      <form @submit.prevent="submitAddCar" class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <UFormField label="License Plate Number" required :error="plateError" :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }">
          <UInput 
            v-model="formState.plateNumber" 
            placeholder="e.g. AB-123-CD" 
            class="font-mono text-lg uppercase tracking-wider" 
            size="xl" 
            :ui="{ base: 'bg-slate-950 border-slate-700 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner' }"
          />
        </UFormField>
        
        <UFormField label="Vehicle Brand" required :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }">
          <UInput 
            v-model="formState.brand" 
            placeholder="e.g. Renault" 
            class="text-lg"
            size="xl" 
            :ui="{ base: 'bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner' }"
          />
        </UFormField>
        
        <UFormField label="Vehicle Model" required :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }">
          <UInput 
            v-model="formState.model" 
            placeholder="e.g. Clio" 
            class="text-lg" 
            size="xl" 
            :ui="{ base: 'bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner' }"
          />
        </UFormField>

        <UFormField label="Vehicle Color" required :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }">
          <UInput 
            v-model="formState.color" 
            placeholder="e.g. Black" 
            class="text-lg"
            size="xl" 
            :ui="{ base: 'bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner' }"
          />
        </UFormField>

        <UFormField class="sm:col-span-2" label="Carte Grise (Official Document)" required :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }">
          <label 
            class="w-full cursor-pointer bg-slate-950 border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 group"
            :class="selectedFile ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'"
          >
            <div class="p-3 rounded-full transition-colors" :class="selectedFile ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 group-hover:text-white'">
              <UIcon name="lucide:upload-cloud" class="w-6 h-6" />
            </div>
            <div class="text-center">
              <span class="text-base font-semibold transition-colors" :class="selectedFile ? 'text-indigo-300' : 'text-slate-200'">
                {{ selectedFile ? selectedFile.name : 'Tap to upload Carte Grise' }}
              </span>
              <p class="text-sm text-slate-500 mt-1">Required for police verification</p>
            </div>
            <input type="file" accept="image/*" class="hidden" @change="handleFileChange" />
          </label>
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-center w-full gap-3 pt-2">
        <UButton 
          label="Cancel" 
          color="neutral" 
          variant="soft" 
          size="xl"
          class="flex-1 sm:flex-none justify-center font-semibold"
          @click="isOpen = false" 
          :disabled="uploadLoading" 
        />
        <UButton 
          :label="carToEdit ? 'Resubmit Registration' : 'Submit Registration'" 
          color="primary" 
          size="xl"
          class="flex-1 sm:flex-none justify-center font-bold shadow-lg shadow-indigo-500/25"
          :loading="uploadLoading" 
          :disabled="!isFormValid"
          @click="submitAddCar"
        />
      </div>
    </template>
  </UModal>
</template>
