<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCarsStore } from '~/stores/cars'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useFirebaseStorage } from 'vuefire'

const props = defineProps<{
  car?: any | null
  owners: any[]
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const carsStore = useCarsStore()
const authStore = useAuthStore()
const storage = useFirebaseStorage()
const toast = useToast()

const selectedUser = ref<any | null>(null)
const selectedFile = ref<File | null>(null)
const uploadLoading = ref(false)

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const isFormValid = computed(() => {
  return selectedUser.value && selectedFile.value
})

const submitTransfer = async () => {
  if (!isFormValid.value || !props.car) return

  uploadLoading.value = true
  try {
    const fileRef = storageRef(storage, `carteGrise/${authStore.currentUser?.uid}/${Date.now()}_${selectedFile.value.name}`)
    const snapshot = await uploadBytes(fileRef, selectedFile.value!)
    const url = await getDownloadURL(snapshot.ref)

    await carsStore.requestOwnershipTransfer({
      carId: props.car.id,
      newOwnerId: selectedUser.value.id,
      carteGriseUrl: url
    })

    isOpen.value = false
    selectedUser.value = null
    selectedFile.value = null
  } catch (error: any) {
    toast.add({ title: 'Transfer failed', description: error.message, color: 'error' })
  } finally {
    uploadLoading.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen" prevent-close title="Transfer Car Ownership"
    description="Transfer your vehicle to another registered owner." :ui="{
      content: 'bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-2xl overflow-hidden',
      header: 'py-4 sm:py-5 border-b border-slate-800'
    }">

    <template #body>
      <form @submit.prevent="submitTransfer" class="space-y-6">
        <div v-if="car" class="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <p class="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Vehicle to Transfer</p>
          <div class="flex items-center gap-3">
            <span class="font-mono text-lg text-amber-400 font-bold">{{ car.plateNumber }}</span>
            <span class="text-slate-300">{{ car.brand }} {{ car.model }}</span>
          </div>
        </div>
        <UFormField label="New Owner" required
          :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }">
          <MoleculesUserSelectMenu 
            v-model="selectedUser" 
            :items="owners" 
            placeholder="Select a new owner..."
            searchable-placeholder="Search by name or identity number..."
          />
        </UFormField>

        <UFormField label="New Carte Grise" required
          :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }">
          <label
            class="w-full cursor-pointer bg-slate-950 border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 group"
            :class="selectedFile ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'">
            <div class="p-3 rounded-full transition-colors"
              :class="selectedFile ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 group-hover:text-white'">
              <UIcon name="lucide:upload-cloud" class="w-6 h-6" />
            </div>
            <div class="text-center">
              <span class="text-base font-semibold transition-colors"
                :class="selectedFile ? 'text-indigo-300' : 'text-slate-200'">
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
        <UButton label="Cancel" color="neutral" variant="soft" size="xl"
          class="flex-1 sm:flex-none justify-center font-semibold" @click="isOpen = false" :disabled="uploadLoading" />
        <UButton label="Request Transfer" color="primary" size="xl"
          class="flex-1 sm:flex-none justify-center font-bold shadow-lg shadow-indigo-500/25" :loading="uploadLoading"
          :disabled="!isFormValid" @click="submitTransfer" />
      </div>
    </template>
  </UModal>
</template>
