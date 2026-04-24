<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCarsStore } from '~/stores/cars'

const userStore = useUserStore()
const carsStore = useCarsStore()

const { userProfile, profileLoading } = storeToRefs(userStore)
const { myCars, carsLoading, actionLoading } = storeToRefs(carsStore)

const isAddModalOpen = ref(false)
const confirmDeleteModalOpen = ref(false)
const carToDelete = ref<string | null>(null)

const openDeleteConfirm = (carId: string) => {
  carToDelete.value = carId
  confirmDeleteModalOpen.value = true
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
            
            <UCard
              v-else-if="userProfile"
              class="bg-slate-900 border border-slate-800 shadow-xl overflow-hidden"
              :ui="{ body: { padding: 'p-0 sm:p-0' } }"
            >
              <div class="p-6 bg-slate-800/30 border-b border-slate-800 flex flex-col items-center text-center">
                <div class="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                  <UIcon name="lucide:user-circle" class="w-8 h-8 text-indigo-400" />
                </div>
                <h3 class="text-lg font-bold text-white">{{ userProfile.fullName || userProfile.name || '—' }}</h3>
                <p class="text-sm text-slate-400 font-mono mt-1">{{ userProfile.identityNumber || '—' }}</p>
              </div>
              <dl class="divide-y divide-slate-800/50 text-sm">
                <div class="flex flex-col p-4 sm:px-6">
                  <dt class="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Birth Date</dt>
                  <dd class="text-slate-200 font-medium">{{ userProfile.birthDate || '—' }}</dd>
                </div>
                <div class="flex flex-col p-4 sm:px-6">
                  <dt class="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Email Address</dt>
                  <dd class="text-slate-200 font-medium break-all">{{ userProfile.email || '—' }}</dd>
                </div>
                <div class="flex flex-col p-4 sm:px-6">
                  <dt class="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Phone Number</dt>
                  <dd class="text-slate-200 font-medium">{{ userProfile.phone || '—' }}</dd>
                </div>
              </dl>
            </UCard>
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
              <UCard
                v-for="car in myCars"
                :key="car.id"
                class="group transition-all duration-300 relative overflow-hidden border shadow-lg hover:shadow-xl"
                :class="car.status === 'delete_pending' 
                  ? 'bg-slate-900/40 border-slate-800 opacity-75 grayscale-[0.5]' 
                  : 'bg-slate-900 border-slate-700 hover:border-slate-500'"
                :ui="{ body: { padding: 'p-0 sm:p-0' } }"
              >
                <!-- Card Header (Plate & Status) -->
                <div class="p-5 border-b border-slate-800/50 flex justify-between items-start" :class="car.status === 'delete_pending' ? 'bg-amber-950/20' : 'bg-slate-800/20'">
                  <div>
                    <div class="flex items-center gap-3">
                      <div class="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-lg font-mono font-bold text-white tracking-[0.15em] shadow-inner">
                        {{ car.plateNumber }}
                      </div>
                    </div>
                    <div class="mt-3">
                      <UBadge
                        :color="car.status === 'active' ? 'success' : (car.status === 'activation_pending' || car.status === 'delete_pending' ? 'warning' : (car.status === 'rejected' ? 'error' : 'neutral'))"
                        variant="subtle"
                        class="capitalize font-semibold text-xs px-2.5 py-1"
                      >
                        {{ car.status.replace('_', ' ') }}
                      </UBadge>
                    </div>
                  </div>
                  
                  <div>
                    <UTooltip v-if="car.status === 'delete_pending'" text="Cancel Deletion Request">
                      <UButton
                        color="primary"
                        variant="soft"
                        icon="lucide:rotate-ccw"
                        size="sm"
                        class="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                        @click="carsStore.cancelDeletion(car.id)"
                        :loading="actionLoading"
                      />
                    </UTooltip>
                    
                    <UTooltip v-else-if="car.status !== 'deleted'" text="Request Deletion">
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="lucide:trash-2"
                        class="opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 p-2 -m-2"
                        @click="openDeleteConfirm(car.id)"
                      />
                    </UTooltip>
                  </div>
                </div>

                <!-- Card Body (Details) -->
                <div class="p-5 grid grid-cols-2 gap-6 bg-slate-900">
                  <div>
                    <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Brand & Model</p>
                    <p class="text-sm text-slate-200 font-medium capitalize">{{ car.brand }} {{ car.model }}</p>
                  </div>
                  <div>
                    <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Color</p>
                    <p class="text-sm text-slate-200 font-medium capitalize">{{ car.color }}</p>
                  </div>
                </div>

                <!-- Card Footer (Action) -->
                <div class="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <UIcon name="lucide:file-text" class="w-4 h-4 text-slate-500" />
                    <span class="text-xs text-slate-400 font-medium uppercase tracking-wider">Carte Grise</span>
                  </div>
                  <UButton
                    :to="car.carteGriseUrl"
                    target="_blank"
                    color="primary"
                    variant="link"
                    icon="lucide:external-link"
                    label="View Doc"
                    :padded="false"
                    class="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                  />
                </div>
              </UCard>
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

    <!-- Add Car Modal -->
    <OrganismsOwnerAddCarModal v-model:open="isAddModalOpen" />

    <!-- Delete Confirmation Modal -->
    <OrganismsOwnerDeleteCarModal v-model:open="confirmDeleteModalOpen" :car-id="carToDelete" />
  </div>
</template>
