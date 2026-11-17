<template>
  <UModal
    v-model:open="isOpen"
    prevent-close
    :title="$t('owner.modals.edit_profile.title')"
    :description="$t('owner.modals.edit_profile.description')"
  >
    <template #body>
      <form class="space-y-5" @submit.prevent="submitUpdate">
        <UFormField
          :label="$t('owner.modals.edit_profile.full_name')"
          required
        >
          <UInput
            v-model="formState.fullName"
            placeholder="John Doe"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="$t('owner.modals.edit_profile.identity_number')"
          required
        >
          <UInput
            v-model="formState.identityNumber"
            placeholder="AB123456"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="$t('owner.modals.edit_profile.birth_date')"
          required
        >
          <UInput
            v-model="formState.birthDate"
            type="date"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <UFormField
          :label="$t('owner.modals.edit_profile.phone')"
          required
        >
          <UInput
            v-model="formState.phone"
            placeholder="+33 6 12 34 56 78"
            size="xl"
            class="w-full"
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
          class="flex-1 sm:flex-none justify-center"
          :disabled="saving"
          @click="isOpen = false"
        />

        <UButton
          :label="$t('owner.modals.edit_profile.save_button')"
          color="primary"
          size="xl"
          class="flex-1 sm:flex-none justify-center font-bold shadow-lg"
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