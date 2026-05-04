<template>
  <UModal
    v-model:open="isOpen"
    prevent-close
    :title="$t('owner.modals.edit_profile.title')"
    :description="$t('owner.modals.edit_profile.description')"
    :ui="{
      content: 'bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-2xl overflow-hidden',
      header: 'py-4 sm:py-5 border-b border-slate-800'
    }"
  >
    <template #body>
      <form @submit.prevent="submitUpdate" class="space-y-5">
        <UFormField
          :label="$t('owner.modals.edit_profile.full_name')"
          required
          :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }"
        >
          <UInput
            v-model="formState.fullName"
            placeholder="John Doe"
            size="xl"
            class="w-full"
            :ui="{ base: 'w-full bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner' }"
          />
        </UFormField>

        <UFormField
          :label="$t('owner.modals.edit_profile.identity_number')"
          required
          :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }"
        >
          <UInput
            v-model="formState.identityNumber"
            placeholder="AB123456"
            size="xl"
            class="w-full"
            :ui="{ base: 'w-full bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner' }"
          />
        </UFormField>

        <UFormField
          :label="$t('owner.modals.edit_profile.birth_date')"
          required
          :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }"
        >
          <UInput
            v-model="formState.birthDate"
            type="date"
            size="xl"
            class="w-full"
            :ui="{ base: 'w-full bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner' }"
          />
        </UFormField>

        <UFormField
          :label="$t('owner.modals.edit_profile.phone')"
          required
          :ui="{ label: { base: 'text-slate-300 font-medium tracking-wide text-sm mb-2' } }"
        >
          <UInput
            v-model="formState.phone"
            placeholder="+33 6 12 34 56 78"
            size="xl"
            class="w-full"
            :ui="{ base: 'w-full bg-slate-950 border-slate-700 focus:ring-indigo-500 shadow-inner' }"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-center w-full gap-3 pt-2">
        <UButton
          :label="$t('common.cancel')"
          color="neutral"
          variant="ghost"
          size="xl"
          class="flex-1 sm:flex-none justify-center hover:bg-slate-800"
          :disabled="saving"
          @click="isOpen = false"
        />

        <UButton
          :label="$t('owner.modals.edit_profile.save_button')"
          color="primary"
          size="xl"
          class="flex-1 sm:flex-none justify-center font-bold shadow-lg shadow-indigo-500/25"
          :loading="saving"
          @click="submitUpdate"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { storeToRefs } from 'pinia'

const isOpen = defineModel<boolean>('open', { required: true })

const userStore = useUserStore()
const { userProfile } = storeToRefs(userStore)

const formState = ref({
  fullName: '',
  identityNumber: '',
  birthDate: '',
  phone: ''
})

const saving = ref(false)

watch(isOpen, (val) => {
  if (val && userProfile.value) {
    formState.value = {
      fullName: userProfile.value.fullName || userProfile.value.name || '',
      identityNumber: userProfile.value.identityNumber || '',
      birthDate: userProfile.value.birthDate || '',
      phone: userProfile.value.phone || ''
    }
  }
})

const submitUpdate = async () => {
  saving.value = true
  try {
    await userStore.updateProfile(formState.value)
    isOpen.value = false
  } finally {
    saving.value = false
  }
}
</script>