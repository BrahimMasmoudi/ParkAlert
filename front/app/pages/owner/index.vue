<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCarsStore } from '~/stores/cars'

const userStore = useUserStore()
const carsStore = useCarsStore()

const { userProfile, profileLoading } = storeToRefs(userStore)
const { myCars, carsLoading } = storeToRefs(carsStore)

const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const confirmDeleteModalOpen = ref(false)
const carToDelete = ref<string | null>(null)

const openDeleteConfirm = (carId: string) => {
  carToDelete.value = carId
  confirmDeleteModalOpen.value = true
}

const handleCarDeleteAction = (carId: string) => {
  const car = myCars.value.find(c => c.id === carId)
  if (car?.status === 'delete_pending') {
    carsStore.cancelDeletion(carId)
  } else {
    openDeleteConfirm(carId)
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 pb-24 relative font-sans">
    <AppHeader title="Citizen Dashboard" role="owner" />

    <UContainer class="py-8 max-w-7xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <!-- Left Column: User Profile -->
        <div class="lg:col-span-4 space-y-6 sticky top-8">
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

        <!-- Right Column: Registered Vehicles -->
        <div class="lg:col-span-8 space-y-6">
          <section>
            <div class="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
              <div>
                <h2 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <UIcon name="lucide:car" class="w-5 h-5 text-indigo-400" />
                  Registered Vehicles
                </h2>
                <p class="text-sm text-slate-400 mt-1">Manage your active and pending vehicles</p>
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
              />
            </div>
          </section>
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

    <!-- Add Car Modal -->
    <OrganismsOwnerAddCarModal v-model:open="isAddModalOpen" />

    <!-- Delete Confirmation Modal -->
    <OrganismsOwnerDeleteCarModal v-model:open="confirmDeleteModalOpen" :car-id="carToDelete" />
  </div>
</template>
