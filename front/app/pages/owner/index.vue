<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCarsStore } from '~/stores/cars'

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

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 pb-24 relative font-sans">
    <AppHeader title="Citizen Dashboard" role="owner" />

    <UContainer class="py-8 max-w-7xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <!-- Left Column: User Profile -->
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

        <!-- Right Column: Dashboard Content -->
        <div class="lg:col-span-8">
          <UTabs :items="tabs" class="w-full" :ui="{ 
            list: 'bg-slate-900 border border-slate-800 p-1 mb-8',
            indicator: 'bg-indigo-600',
            trigger: 'font-bold uppercase tracking-widest text-xs py-3'
          }">
            <template #vehicles>
              <section class="space-y-8">
                <div>
                  <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                    <div>
                      <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <UIcon name="lucide:car" class="w-5 h-5 text-indigo-400" />
                        Registered Vehicles
                      </h2>
                      <p class="text-sm text-slate-400 mt-1">Active and pending vehicle registrations</p>
                    </div>
                    <UButton
                      icon="lucide:plus"
                      label="Register Vehicle"
                      color="primary"
                      size="md"
                      class="hidden sm:flex shadow-md shadow-indigo-500/20"
                      @click="isAddModalOpen = true"
                    />
                  </div>

                  <LoadingSkeleton v-if="carsLoading" :count="2" class="h-48 mb-4" />

                  <div v-else-if="!myCars?.length" class="flex flex-col items-center justify-center py-20 bg-slate-900 border border-slate-800 border-dashed rounded-2xl">
                    <div class="p-4 bg-slate-800 rounded-full mb-4">
                      <UIcon name="lucide:car-front" class="w-8 h-8 text-slate-400" />
                    </div>
                    <p class="text-lg text-white font-bold tracking-tight">No vehicles found</p>
                    <p class="text-slate-400 text-sm mt-2 max-w-sm text-center">You haven't registered any vehicles yet. Add a vehicle to manage its parking status.</p>
                    <UButton
                      icon="lucide:plus"
                      label="Register a Vehicle"
                      color="primary"
                      size="lg"
                      class="mt-6 sm:hidden"
                      @click="isAddModalOpen = true"
                    />
                  </div>

                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <MoleculesOwnerCarCard
                      v-for="car in myCars"
                      :key="car.id"
                      :car="car"
                      @delete="handleCarDeleteAction"
                      @retry="handleCarRetryAction"
                      @transfer="handleCarTransferAction"
                    />
                  </div>
                </div>

                <!-- Ownership History Section -->
                <div v-if="historicalCars?.length" class="mt-12 pt-8 border-t border-slate-800">
                  <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-slate-800 rounded-lg">
                      <UIcon name="lucide:history" class="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <h2 class="text-xl font-bold tracking-tight text-white">Ownership History</h2>
                      <p class="text-xs text-slate-500 mt-0.5">Archive of vehicles you previously owned</p>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <MoleculesOwnerCarCard
                      v-for="car in historicalCars"
                      :key="car.id"
                      :car="car"
                      :readonly="true"
                    />
                  </div>
                </div>
              </section>
            </template>

            <template #fines>
              <section class="space-y-6">
                <div class="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                  <div>
                    <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <UIcon name="lucide:circle-dollar-sign" class="w-5 h-5 text-red-500" />
                      Parking Fines
                    </h2>
                    <p class="text-sm text-slate-400 mt-1">View and settle your vehicle violations</p>
                  </div>
                </div>

                <LoadingSkeleton v-if="finesLoading" :count="3" class="h-32 mb-4" />

                <div v-else-if="!myFines?.length" class="flex flex-col items-center justify-center py-20 bg-slate-900 border border-slate-800 border-dashed rounded-2xl">
                  <div class="p-4 bg-slate-800 rounded-full mb-4">
                    <UIcon name="lucide:smile" class="w-8 h-8 text-green-500" />
                  </div>
                  <p class="text-lg text-white font-bold tracking-tight">No fines found</p>
                  <p class="text-slate-400 text-sm mt-2 max-w-sm text-center">You have no pending or past fines. Good job on following parking regulations!</p>
                </div>

                <div v-else class="space-y-4">
                  <!-- Unpaid Fines Header -->
                  <div v-if="myFines.some(f => f.status === 'unpaid')" class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Unpaid Violations</span>
                    <div class="h-px flex-1 bg-red-950"></div>
                  </div>

                  <MoleculesOwnerFineCard
                    v-for="fine in (myFines || []).filter(f => f.status === 'unpaid')"
                    :key="fine.id"
                    :fine="fine"
                  />

                  <!-- Paid Fines Header -->
                  <div v-if="(myFines || []).some(f => f.status === 'paid')" class="flex items-center gap-2 mt-8 mb-2">
                    <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Settled Records</span>
                    <div class="h-px flex-1 bg-slate-800"></div>
                  </div>

                  <MoleculesOwnerFineCard
                    v-for="fine in (myFines || []).filter(f => f.status === 'paid')"
                    :key="fine.id"
                    :fine="fine"
                  />
                </div>
              </section>
            </template>
          </UTabs>
        </div>
      </div>
    </UContainer>

    <!-- FAB for adding car (Mobile Only) -->
    <UButton
      icon="lucide:plus"
      size="xl"
      color="primary"
      class="fixed bottom-6 right-6 shadow-xl shadow-indigo-500/20 rounded-full w-14 h-14 flex sm:hidden items-center justify-center transition-transform hover:scale-105 z-40"
      @click="isAddModalOpen = true"
    />

    <!-- Edit Profile Modal -->
    <OrganismsOwnerEditProfileModal v-model:open="isEditModalOpen" />

    <!-- Add/Edit Car Modal -->
    <OrganismsOwnerAddCarModal v-model:open="isAddModalOpen" :car-to-edit="carToEdit" />

    <!-- Delete Confirmation Modal -->
    <OrganismsOwnerDeleteCarModal v-model:open="confirmDeleteModalOpen" :car-id="carToDelete" />

    <!-- Transfer Car Modal -->
    <OrganismsOwnerTransferCarModal v-model:open="isTransferModalOpen" :car="carToTransfer" :owners="userStore.availableOwners" />
  </div>
</template>
