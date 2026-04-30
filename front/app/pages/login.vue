<script setup lang="ts">
definePageMeta({ layout: false })

const authStore = useAuthStore()
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
    <!-- Ambient blobs -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
    </div>

    <div class="relative w-full max-w-sm flex flex-col items-center gap-8">
      <!-- Logo -->
      <div class="text-center">
        <div
          class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-600 shadow-2xl shadow-blue-600/40 mb-5">
          <UIcon name="lucide:shield-check" class="w-10 h-10 text-white" />
        </div>
        <h1 class="text-4xl font-bold text-white tracking-tight">
          ParkAlert
        </h1>
        <p class="text-slate-400 mt-2 text-sm">
          Government Parking Enforcement System
        </p>
      </div>

      <!-- Card -->
      <UCard class="w-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
        <div class="flex flex-col items-center gap-6 py-2">
          <div class="text-center">
            <p class="text-white font-semibold text-lg">
              Sign in to continue
            </p>
            <p class="text-slate-400 text-sm mt-1">
              Use your Google account to access the system
            </p>
          </div>

          <!-- Google Sign-In Button -->
          <UButton id="google-signin-btn" block size="xl" :loading="authStore.loading"
            class="bg-white hover:bg-slate-100 text-slate-800 font-semibold shadow-lg transition-all duration-200 gap-3"
            @click="authStore.loginWithGoogle">
            <template #leading>
              <!-- Google G icon (inline SVG to avoid external icon pack dependency) -->
              <svg viewBox="0 0 48 48" class="w-5 h-5">
                <path fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            </template>
            Continue with Google
          </UButton>

          <p class="text-slate-500 text-xs text-center px-4">
            Access is restricted to authorised government personnel and registered vehicle owners.
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>
