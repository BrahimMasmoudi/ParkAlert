<template>
  <UModal
    v-model:open="isOpen"
    prevent-close
    :title="carToEdit ? $t('owner.modals.add_car.title_edit') : $t('owner.modals.add_car.title_new')"
    :description="carToEdit ? $t('owner.modals.add_car.desc_edit') : $t('owner.modals.add_car.desc_new')"
  >
    <template #body>
      <form class="grid grid-cols-1 sm:grid-cols-2 gap-6" @submit.prevent="handleSubmit">
        <UFormField
          :label="$t('owner.modals.add_car.plate_label')"
          required
          :error="plateError"
          :help="transferMessage"
        >
          <UInput
            v-model="formState.plateNumber"
            dir="ltr"
            :placeholder="$t('owner.modals.add_car.plate_placeholder')"
            class="font-mono text-lg uppercase tracking-wider w-full"
            size="xl"
            :loading="isCheckingPlate"
            :disabled="isTransferMode || Boolean(props.carToEdit)"
          />
        </UFormField>

        <div v-if="isTransferMode" class="sm:col-span-1 flex items-end pb-1">
          <UButton
            color="neutral"
            variant="ghost"
            icon="lucide:refresh-cw"
            size="sm"
            @click="resetPlate"
          >
            {{ $t('owner.modals.add_car.change_plate') }}
          </UButton>
        </div>

        <template v-if="!isTransferMode">
          <UFormField
            :label="$t('owner.modals.add_car.brand_label')"
            required
          >
            <UInput
              v-model="formState.brand"
              placeholder="e.g. Renault"
              class="text-lg w-full"
              size="xl"
            />
          </UFormField>

          <UFormField
            :label="$t('owner.modals.add_car.model_label')"
            required
          >
            <UInput
              v-model="formState.model"
              placeholder="e.g. Clio"
              class="text-lg w-full"
              size="xl"
            />
          </UFormField>

          <UFormField
            :label="$t('owner.modals.add_car.color_label')"
            required
          >
            <UInput
              v-model="formState.color"
              placeholder="e.g. Black"
              class="text-lg w-full"
              size="xl"
            />
          </UFormField>
        </template>

        <UFormField
          class="sm:col-span-2"
          :label="isTransferMode ? $t('owner.modals.add_car.transfer_carte_grise_label') : $t('owner.modals.add_car.carte_grise_label')"
          required
        >
          <label
            class="w-full cursor-pointer bg-elevated border-2 border-dashed rounded-xl px-4 py-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 group"
            :class="selectedFile ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/60 hover:bg-muted'"
          >
            <div
              class="p-3 rounded-full transition-colors"
              :class="selectedFile ? 'bg-primary/15 text-primary' : 'bg-muted text-muted group-hover:text-highlighted'"
            >
              <UIcon name="lucide:upload-cloud" class="w-6 h-6" />
            </div>
            <div class="text-center">
              <span
                class="text-base font-semibold transition-colors"
                :class="selectedFile ? 'text-primary' : 'text-highlighted'"
              >
                {{ selectedFile ? selectedFile.name : $t('owner.modals.add_car.tap_to_upload') }}
              </span>
              <p class="text-sm text-muted mt-1">{{ $t('owner.modals.add_car.upload_required') }}</p>
            </div>
            <input
              type="file"
              accept="image/*,application/pdf"
              class="hidden"
              @change="handleFileChange"
            >
          </label>
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-center w-full gap-3 pt-2">
        <UButton
          :label="$t('common.cancel')"
          color="neutral"
          variant="soft"
          size="xl"
          class="flex-1 sm:flex-none justify-center font-semibold"
          :disabled="uploadLoading"
          @click="isOpen = false"
        />
        <UButton
          :label="isTransferMode ? $t('owner.modals.add_car.submit_transfer') : (carToEdit ? $t('owner.modals.add_car.submit_edit') : $t('owner.modals.add_car.submit_new'))"
          color="primary"
          size="xl"
          class="flex-1 sm:flex-none justify-center font-bold shadow-lg"
          :loading="uploadLoading"
          :disabled="!isFormValid"
          @click="handleSubmit"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useFirebaseStorage } from 'vuefire'
import { useCarsStore } from '~/stores/cars'
import { useUserStore } from '~/stores/user'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
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

const isCheckingPlate = ref(false)
const isTransferMode = ref(false)
const transferMessage = ref('')
const plateAvailabilityError = ref('')

let checkSequence = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function clearPendingPlateCheck() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  checkSequence += 1
  isCheckingPlate.value = false
}

function resetModalState() {
  clearPendingPlateCheck()
  isTransferMode.value = false
  transferMessage.value = ''
  plateAvailabilityError.value = ''
  selectedFile.value = null
}

watch(
  [() => isOpen.value, () => props.carToEdit],
  ([open, carToEdit]) => {
    resetModalState()
    if (open && carToEdit) {
      formState.value = {
        plateNumber: carToEdit.plateNumber,
        brand: carToEdit.brand,
        model: carToEdit.model,
        color: carToEdit.color,
      }
    }
    else if (open) {
      formState.value = {
        plateNumber: '',
        brand: '',
        model: '',
        color: '',
      }
    }
  },
  { immediate: true }
)

const { isFrenchPlateValid, formatFrenchPlate } = useVehicleValidation()
const isPlateValid = computed(() => isFrenchPlateValid(formState.value.plateNumber))

watch(() => formState.value.plateNumber, (newVal) => {
  clearPendingPlateCheck()
  plateAvailabilityError.value = ''

  if (!newVal) {
    isTransferMode.value = false
    transferMessage.value = ''
    return
  }

  const formatted = formatFrenchPlate(newVal)
  if (formatted !== newVal) {
    formState.value.plateNumber = formatted
  }

  if (!isFrenchPlateValid(formatted) || props.carToEdit) {
    isTransferMode.value = false
    transferMessage.value = ''
    return
  }

  const seq = ++checkSequence
  isCheckingPlate.value = true

  debounceTimer = setTimeout(async () => {
    try {
      const result = await carsStore.checkPlate(formatted)
      if (seq !== checkSequence) return

      if (result.available) {
        isTransferMode.value = false
        transferMessage.value = ''
        plateAvailabilityError.value = ''
      }
      else if (result.eligibleForTransfer) {
        isTransferMode.value = true
        transferMessage.value = t('owner.modals.add_car.transfer_eligible_hint')
        plateAvailabilityError.value = ''
      }
      else {
        isTransferMode.value = false
        transferMessage.value = ''
        if (result.reason === 'OWNED_BY_CALLER') {
          plateAvailabilityError.value = t('owner.modals.add_car.already_owned_error')
        }
        else if (result.reason === 'TRANSFER_IN_PROGRESS') {
          plateAvailabilityError.value = t('owner.modals.add_car.transfer_in_progress_error')
        }
        else {
          plateAvailabilityError.value = t('owner.modals.add_car.ineligible_plate_error')
        }
      }
    }
    catch {
      if (seq !== checkSequence) return
      isTransferMode.value = false
      transferMessage.value = ''
    }
    finally {
      if (seq === checkSequence) {
        isCheckingPlate.value = false
      }
    }
  }, 300)
})

const resetPlate = () => {
  resetModalState()
  formState.value.plateNumber = ''
}

const plateError = computed(() => {
  if (formState.value.plateNumber && !isPlateValid.value) {
    return t('owner.modals.add_car.invalid_plate_format')
  }
  return plateAvailabilityError.value
})

const isFormValid = computed(() => {
  if (isCheckingPlate.value || plateAvailabilityError.value) {
    return false
  }
  if (isTransferMode.value) {
    return isPlateValid.value && selectedFile.value !== null
  }
  return (
    isPlateValid.value
    && formState.value.brand.trim() !== ''
    && formState.value.model.trim() !== ''
    && formState.value.color.trim() !== ''
    && selectedFile.value !== null
  )
})

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0] ?? null
  }
}

async function cleanupUploadedFile(path: string) {
  try {
    await deleteObject(storageRef(storage, path))
  }
  catch {
    // Best-effort cleanup of orphaned upload
  }
}

const handleSubmit = async () => {
  if (isTransferMode.value) {
    await submitTransferRequest()
  }
  else {
    await submitAddCar()
  }
}

const submitTransferRequest = async () => {
  if (!selectedFile.value || !userProfile.value?.uid) return

  uploadLoading.value = true
  const objectPath = `transfers/${userProfile.value.uid}/${Date.now()}_${selectedFile.value.name}`
  try {
    const fileRef = storageRef(storage, objectPath)
    await uploadBytes(fileRef, selectedFile.value)

    await carsStore.requestOwnershipTransfer({
      plateNumber: formState.value.plateNumber,
      carteGriseUrl: objectPath,
    })

    isOpen.value = false
    resetPlate()
  }
  catch (error: any) {
    await cleanupUploadedFile(objectPath)
    if (error?.message?.includes('UNPAID_FINES_EXIST')) {
      toast.add({
        title: t('owner.modals.add_car.transfer_blocked_title'),
        description: t('owner.modals.add_car.transfer_blocked_unpaid'),
        color: 'error',
      })
    }
    else {
      toast.add({
        title: t('owner.modals.add_car.transfer_failed_title'),
        description: error?.message,
        color: 'error',
      })
    }
  }
  finally {
    uploadLoading.value = false
  }
}

const submitAddCar = async () => {
  if (!isFormValid.value || !userProfile.value?.uid) {
    if (formState.value.plateNumber && !isPlateValid.value) {
      toast.add({
        title: t('owner.modals.add_car.invalid_plate_title'),
        description: t('owner.modals.add_car.invalid_plate_format'),
        color: 'error',
      })
    }
    else if (!selectedFile.value) {
      toast.add({
        title: t('owner.modals.add_car.missing_doc_title'),
        description: t('owner.modals.add_car.missing_doc_desc'),
        color: 'error',
      })
    }
    else {
      toast.add({
        title: t('owner.modals.add_car.incomplete_form_title'),
        description: t('owner.modals.add_car.incomplete_form_desc'),
        color: 'error',
      })
    }
    return
  }

  uploadLoading.value = true
  const objectPath = `carteGrise/${userProfile.value.uid}/${Date.now()}_${selectedFile.value.name}`
  try {
    const fileRef = storageRef(storage, objectPath)
    await uploadBytes(fileRef, selectedFile.value)

    if (props.carToEdit) {
      await carsStore.retryCar({
        carId: props.carToEdit.id,
        plateNumber: formState.value.plateNumber,
        brand: formState.value.brand,
        model: formState.value.model,
        color: formState.value.color,
        carteGriseUrl: objectPath,
      })
    }
    else {
      await carsStore.addCar({
        plateNumber: formState.value.plateNumber,
        brand: formState.value.brand,
        model: formState.value.model,
        color: formState.value.color,
        carteGriseUrl: objectPath,
      })
    }

    isOpen.value = false
    formState.value = { plateNumber: '', brand: '', model: '', color: '' }
    selectedFile.value = null
  }
  catch (error: any) {
    await cleanupUploadedFile(objectPath)
    if (error?.message?.includes('VEHICLE_ALREADY_REGISTERED')) {
      isTransferMode.value = true
      transferMessage.value = t('owner.modals.add_car.transfer_eligible_hint')
    }
    else {
      toast.add({
        title: t('owner.modals.add_car.upload_failed_title'),
        description: error?.message,
        color: 'error',
      })
    }
  }
  finally {
    uploadLoading.value = false
  }
}
</script>
