<script setup lang="ts">
const finesStore = useFinesStore()
const authStore = useAuthStore()
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-white">
    <AppHeader title="My Fines" role="owner" />

    <UContainer class="py-6 max-w-lg mx-auto">
      <!-- Loading -->
      <LoadingSkeleton v-if="finesStore.finesLoading" :count="3" />

      <template v-else>
        <!-- Active fine alert banner -->
        <Transition name="slide-down">
          <div
            v-if="finesStore.hasUnpaidFines"
            class="bg-red-500/15 border border-red-500/40 rounded-2xl p-4 mb-6 flex items-start gap-3"
          >
            <UIcon name="lucide:alert-triangle" class="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p class="font-semibold text-red-300">
                You have outstanding fines
              </p>
              <p class="text-red-400/80 text-sm mt-0.5">
                Please resolve your unpaid fines to avoid further penalties.
              </p>
            </div>
          </div>
        </Transition>

        <!-- All clear -->
        <div
          v-if="!finesStore.myFines?.length"
          class="text-center py-16"
        >
          <UIcon name="lucide:shield-check" class="w-14 h-14 mx-auto mb-3 text-emerald-400/60" />
          <p class="text-white font-semibold text-lg">
            No fines found
          </p>
          <p class="text-slate-500 text-sm mt-1">
            Your vehicle is in good standing.
          </p>
        </div>

        <!-- Fine cards -->
        <div class="space-y-3">
          <UCard
            v-for="fine in finesStore.myFines"
            :key="fine.id"
            class="border transition-all duration-200"
            :class="fine.status === 'unpaid'
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-slate-800/50 border-slate-700/50'"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-bold text-amber-400 text-lg">{{ fine.plateNumber }}</span>
                  <UBadge
                    :color="fine.status === 'unpaid' ? 'error' : 'success'"
                    variant="soft"
                    class="capitalize"
                  >
                    {{ fine.status }}
                  </UBadge>
                </div>
                <p class="text-2xl font-bold" :class="fine.status === 'unpaid' ? 'text-red-300' : 'text-slate-300'">
                  €{{ fine.amount }}
                </p>
                <p class="text-slate-400 text-xs">
                  Issued: {{ fine.issuedAt?.toDate ? fine.issuedAt.toDate().toLocaleDateString() : '—' }}
                </p>
                <p v-if="fine.notes" class="text-slate-400 text-xs">
                  {{ fine.notes }}
                </p>
              </div>

              <UButton
                v-if="fine.status === 'unpaid'"
                :id="`pay-fine-${fine.id}`"
                size="sm"
                :loading="finesStore.acting"
                class="bg-red-600 hover:bg-red-500 text-white font-semibold flex-shrink-0"
                @click="finesStore.payFine(fine.id)"
              >
                Pay Now
              </UButton>
              <UIcon
                v-else
                name="lucide:check-circle-2"
                class="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1"
              />
            </div>
          </UCard>
        </div>
      </template>
    </UContainer>
  </div>
</template>

<style scoped>
.slide-down-enter-active { transition: all 0.3s ease; }
.slide-down-enter-from   { opacity: 0; transform: translateY(-12px); }
</style>
