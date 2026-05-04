<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <div class="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
      <section>
        <h2 class="text-lg font-bold text-white mb-4 tracking-tight flex items-center gap-2">
          <UIcon name="lucide:user" class="w-5 h-5 text-indigo-400" />
          Personal Information
        </h2>
        <LoadingSkeleton v-if="profileLoading" :count="1" class="h-64" />
        <OrganismsOwnerProfileCard 
          v-else-if="userProfile" 
          :user-profile="userProfile" 
          @edit="isEditModalOpen = true" 
        />
      </section>
    </div>

    <div class="lg:col-span-8">
      <UTabs :items="tabs" class="w-full" :ui="{ 
        list: 'bg-slate-900 border border-slate-800 p-1 mb-8',
        indicator: 'bg-indigo-600',
        trigger: 'font-bold uppercase tracking-widest text-xs py-3'
      }">
        <template #vehicles>
          <OrganismsOwnerVehiclesTab
            :cars="myCars"
            :historical-cars="historicalCars"
            :loading="carsLoading"
            @add="isAddModalOpen = true"
            @delete="handleCarDeleteAction"
            @retry="handleCarRetryAction"
            @transfer="handleCarTransferAction"
          />
        </template>

        <template #fines>
          <OrganismsOwnerFinesTab
            :fines="myFines"
            :loading="finesLoading"
          />
        </template>
      </UTabs>
    </div>
  </div>

  <UButton
    icon="lucide:plus"
    size="xl"
    color="primary"
    class="fixed bottom-6 right-6 shadow-xl shadow-indigo-500/20 rounded-full w-14 h-14 flex sm:hidden items-center justify-center transition-transform hover:scale-105 z-40"
    @click="isAddModalOpen = true"
  />

  <OrganismsOwnerEditProfileModal v-model:open="isEditModalOpen" />
  <OrganismsOwnerAddCarModal v-model:open="isAddModalOpen" :car-to-edit="carToEdit" />
  <OrganismsOwnerDeleteCarModal v-model:open="confirmDeleteModalOpen" :car-id="carToDelete" />
  <OrganismsOwnerTransferCarModal v-model:open="isTransferModalOpen" :car="carToTransfer" :owners="userStore.availableOwners" />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCarsStore } from '~/stores/cars'

definePageMeta({
  title: 'Citizen Dashboard',
  role: 'owner',
  containerClass: 'max-w-7xl',
  containerPadding: 'py-8'
})

const userStore = useUserStore()
const carsStore = useCarsStore()
const finesStore = useFinesStore()

const { userProfile, profileLoading } = storeToRefs(userStore)
const { myCars, carsLoading, historicalCars, historicalCarsLoading } = storeToRefs(carsStore)
const { myFines, finesLoading } = storeToRefs(finesStore)

const tabs = computed(() => [
  {
    label: 'Vehicles',
    icon: 'i-lucide-car',
    slot: 'vehicles',
    badge: myCars.value?.length || 0
  },
  {
    label: 'Fines',
    icon: 'i-lucide-circle-dollar-sign',
    slot: 'fines',
    badge: myFines.value?.filter(f => f.status === 'unpaid').length || 0
  }
])

const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const confirmDeleteModalOpen = ref(false)
const carToDelete = ref<string | null>(null)
const carToEdit = ref<any | null>(null)

const isTransferModalOpen = ref(false)
const carToTransfer = ref<any | null>(null)

watch(isAddModalOpen, (newVal) => {
  if (!newVal) {
    setTimeout(() => { carToEdit.value = null }, 300)
  }
})

const openDeleteConfirm = (carId: string) => {
  carToDelete.value = carId
  confirmDeleteModalOpen.value = true
}

const handleCarDeleteAction = (carId: string) => {
  const car = myCars.value.find(c => c.id === carId)
  if (car?.status === 'deletion_requested') {
    carsStore.cancelCarDeletion(carId)
  } else {
    openDeleteConfirm(carId)
  }
}

const handleCarRetryAction = (carId: string) => {
  const car = myCars.value.find(c => c.id === carId)
  if (car) {
    carToEdit.value = car
    isAddModalOpen.value = true
  }
}

const handleCarTransferAction = (carId: string) => {
  const car = myCars.value.find(c => c.id === carId)
  if (car) {
    carToTransfer.value = car
    isTransferModalOpen.value = true
  }
}
</script>
