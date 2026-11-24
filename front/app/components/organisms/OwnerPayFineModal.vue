<template>
  <UModal
    v-model:open="open"
    :dismissible="!submitting"
    :close="{ disabled: submitting }"
    :title="$t('owner.fines.payment_modal.title')"
    :description="$t('owner.fines.payment_modal.subtitle')"
  >
    <template #body>
      <div class="space-y-4">
        <div
          v-if="displayFine"
          class="bg-elevated border border-default rounded-xl p-4 flex items-center justify-between gap-4"
        >
          <div class="space-y-0.5 min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {{ $t('owner.fines.payment_modal.summary_plate') }}
            </p>
            <p dir="ltr" class="text-base font-bold text-highlighted tracking-tight truncate">
              {{ displayFine.plateNumber }}
            </p>
            <p dir="ltr" class="text-[11px] font-mono text-dimmed uppercase">
              {{ $t('owner.fines.payment_modal.summary_reference') }}: #{{ displayFine.id.slice(-6).toUpperCase() }}
            </p>
          </div>
          <div class="text-end shrink-0">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {{ $t('owner.fines.payment_modal.summary_amount') }}
            </p>
            <p dir="ltr" class="text-xl font-black text-highlighted leading-tight">
              TND {{ displayFine.amount }}
            </p>
          </div>
        </div>

        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-shield-check"
          :description="$t('owner.fines.payment_modal.simulated_notice')"
        />

        <UAlert
          v-if="isStaleNonPayable"
          color="warning"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          :description="$t('owner.fines.payment_modal.stale_fine_warning')"
        />

        <UAlert
          v-else-if="submitErrorKey"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :description="$t(submitErrorKey)"
        />

        <UForm
          :id="PAYMENT_FORM_ID"
          :state="formState"
          class="space-y-4"
          @submit="handleSubmit"
        >
          <UFormField
            name="cardholderName"
            :label="$t('owner.fines.payment_modal.cardholder_label')"
            required
            :error="cardholderError ? $t(cardholderError) : undefined"
          >
            <UInput
              v-model="formState.cardholderName"
              dir="auto"
              autocomplete="cc-name"
              enterkeyhint="next"
              size="lg"
              class="w-full"
              :disabled="submitting || isStaleNonPayable"
              :placeholder="$t('owner.fines.payment_modal.cardholder_placeholder')"
              @blur="touched.cardholderName = true"
            />
          </UFormField>

          <UFormField
            name="cardNumber"
            :label="$t('owner.fines.payment_modal.card_number_label')"
            required
            :error="cardNumberError ? $t(cardNumberError) : undefined"
          >
            <UInput
              :model-value="formState.cardNumber"
              dir="ltr"
              type="text"
              inputmode="numeric"
              autocomplete="cc-number"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              enterkeyhint="next"
              size="lg"
              class="w-full"
              :ui="{ base: 'text-left font-mono tracking-wider' }"
              :disabled="submitting || isStaleNonPayable"
              :placeholder="$t('owner.fines.payment_modal.card_number_placeholder')"
              @update:model-value="handleCardNumberUpdate"
              @input="syncSanitizedInput($event, 'cardNumber', formatCardNumber)"
              @blur="touched.cardNumber = true"
            >
              <template v-if="detectedBrand" #trailing>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  class="font-bold uppercase tracking-wider"
                >
                  {{ $t(`owner.fines.payment_modal.brands.${detectedBrand}`) }}
                </UBadge>
              </template>
            </UInput>
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField
              name="expiry"
              :label="$t('owner.fines.payment_modal.expiry_label')"
              :hint="$t('owner.fines.payment_modal.expiry_placeholder')"
              required
              :error="expiryError ? $t(expiryError) : undefined"
            >
              <UInput
                :model-value="formState.expiry"
                dir="ltr"
                type="text"
                inputmode="numeric"
                autocomplete="cc-exp"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                enterkeyhint="next"
                size="lg"
                class="w-full"
                :ui="{ base: 'text-left font-mono' }"
                :disabled="submitting || isStaleNonPayable"
                :placeholder="$t('owner.fines.payment_modal.expiry_placeholder')"
                @update:model-value="handleExpiryUpdate"
                @input="syncSanitizedInput($event, 'expiry', formatExpiry)"
                @blur="touched.expiry = true"
              />
            </UFormField>

            <UFormField
              name="cvv"
              :label="$t('owner.fines.payment_modal.cvv_label')"
              required
              :error="cvvError ? $t(cvvError) : undefined"
            >
              <UInput
                :model-value="formState.cvv"
                dir="ltr"
                type="text"
                inputmode="numeric"
                autocomplete="cc-csc"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                enterkeyhint="done"
                size="lg"
                class="w-full"
                :ui="{ base: 'text-left font-mono' }"
                :disabled="submitting || isStaleNonPayable"
                :placeholder="$t('owner.fines.payment_modal.cvv_placeholder')"
                @update:model-value="handleCvvUpdate"
                @input="syncSanitizedInput($event, 'cvv', formatCvv)"
                @blur="touched.cvv = true"
              />
            </UFormField>
          </div>
        </UForm>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row justify-end w-full gap-3">
        <UButton
          type="button"
          :label="$t('common.cancel')"
          color="neutral"
          variant="soft"
          size="lg"
          class="min-h-11 justify-center font-semibold"
          :disabled="submitting"
          @click="handleCancel"
        />
        <UButton
          type="submit"
          :form="PAYMENT_FORM_ID"
          :label="submitting ? $t('owner.fines.payment_modal.submitting_button') : $t('owner.fines.payment_modal.confirm_button', { amount: displayFine?.amount ?? 0 })"
          color="primary"
          size="lg"
          icon="i-lucide-credit-card"
          class="min-h-11 justify-center font-bold shadow-lg"
          :loading="submitting"
          :disabled="submitting || isStaleNonPayable"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { Fine } from '~/stores/fines'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  fine: Fine | null
  loading?: boolean
}>()

const { t } = useI18n()
const toast = useToast()
const finesStore = useFinesStore()
const {
  stripCardDigits,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  validateCardholderName,
  validateCardNumber,
  validateExpiry,
  validateCvv,
} = useCardValidation()

const PAYMENT_FORM_ID = 'owner-pay-fine-form'

const formState = reactive({
  cardholderName: '',
  cardNumber: '',
  expiry: '',
  cvv: '',
})

const touched = reactive({
  cardholderName: false,
  cardNumber: false,
  expiry: false,
  cvv: false,
})

const submitting = ref(false)
const submitAttempted = ref(false)
const submitErrorKey = ref<string | null>(null)
const paymentAttemptId = ref<string | null>(null)
const submittedSummaryKey = ref<string | null>(null)
const lastKnownFine = ref<Fine | null>(null)

const displayFine = computed(() => props.fine ?? lastKnownFine.value)

const detectedBrand = computed(() => detectCardBrand(stripCardDigits(formState.cardNumber)))

const cardholderError = computed(() =>
  touched.cardholderName || submitAttempted.value ? validateCardholderName(formState.cardholderName) : null,
)
const cardNumberError = computed(() =>
  touched.cardNumber || submitAttempted.value ? validateCardNumber(formState.cardNumber) : null,
)
const expiryError = computed(() =>
  touched.expiry || submitAttempted.value ? validateExpiry(formState.expiry) : null,
)
const cvvError = computed(() =>
  touched.cvv || submitAttempted.value ? validateCvv(formState.cvv, detectedBrand.value) : null,
)

const isOwnAttemptPaid = computed(() =>
  Boolean(
    open.value
    && paymentAttemptId.value
    && props.fine?.status === 'paid'
    && props.fine?.paymentAttemptId === paymentAttemptId.value,
  ),
)

const isStaleNonPayable = computed(() =>
  Boolean(
    open.value
    && !submitting.value
    && !props.loading
    && !isOwnAttemptPaid.value
    && (!props.fine || props.fine.status !== 'unpaid' || props.fine.disputeStatus === 'pending'),
  ),
)

function createAttemptId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function formatCvv(value: string): string {
  const maxLen = detectedBrand.value === 'amex' ? 4 : 3
  return stripCardDigits(value).slice(0, maxLen)
}

function handleCardNumberUpdate(value: string | number) {
  formState.cardNumber = formatCardNumber(String(value ?? ''))
}

function handleExpiryUpdate(value: string | number) {
  formState.expiry = formatExpiry(String(value ?? ''))
}

function handleCvvUpdate(value: string | number) {
  formState.cvv = formatCvv(String(value ?? ''))
}

function syncSanitizedInput(
  event: Event,
  field: 'cardNumber' | 'expiry' | 'cvv',
  formatter: (val: string) => string,
) {
  const target = event.target as HTMLInputElement | null
  if (!target) return
  const next = formatter(target.value)
  formState[field] = next
  if (target.value !== next) {
    target.value = next
  }
}

function clearCardInputs() {
  formState.cardholderName = ''
  formState.cardNumber = ''
  formState.expiry = ''
  formState.cvv = ''
  touched.cardholderName = false
  touched.cardNumber = false
  touched.expiry = false
  touched.cvv = false
  submitAttempted.value = false
  submitErrorKey.value = null
}

function resetModalState() {
  clearCardInputs()
  paymentAttemptId.value = null
  submittedSummaryKey.value = null
  lastKnownFine.value = null
}

function mapServerErrorKey(code?: string): string {
  switch (code) {
    case 'functions/failed-precondition':
      return 'owner.fines.payment_modal.errors.server_failed_precondition'
    case 'functions/permission-denied':
      return 'owner.fines.payment_modal.errors.server_permission_denied'
    case 'functions/not-found':
      return 'owner.fines.payment_modal.errors.server_not_found'
    case 'functions/invalid-argument':
      return 'owner.fines.payment_modal.errors.server_invalid_argument'
    case 'functions/deadline-exceeded':
      return 'owner.fines.payment_modal.errors.server_timeout'
    case 'functions/unavailable':
      return 'owner.fines.payment_modal.errors.server_unavailable'
    default:
      return 'owner.fines.payment_modal.errors.server_generic'
  }
}

function handleSuccessClose(reference?: string) {
  toast.add({
    title: t('owner.fines.payment_modal.success_title'),
    description: t('owner.fines.payment_modal.success_desc', { reference: reference || '' }),
    color: 'success',
  })
  resetModalState()
  open.value = false
  submitting.value = false
}

function reconcileLiveFine(): boolean {
  if (!open.value || props.loading) return false
  if (isOwnAttemptPaid.value) {
    handleSuccessClose(props.fine?.paymentReference)
    return true
  }
  if (isStaleNonPayable.value) {
    clearCardInputs()
    return true
  }
  return false
}

function handleCancel() {
  if (submitting.value) return
  open.value = false
}

async function handleSubmit() {
  if (submitting.value || isStaleNonPayable.value || !props.fine) return

  submitAttempted.value = true
  const nameErr = validateCardholderName(formState.cardholderName)
  const numErr = validateCardNumber(formState.cardNumber)
  const expErr = validateExpiry(formState.expiry)
  const cvvErr = validateCvv(formState.cvv, detectedBrand.value)

  if (nameErr || numErr || expErr || cvvErr) return

  const digits = stripCardDigits(formState.cardNumber)
  const brand = detectCardBrand(digits)
  if (!brand) return

  const cleanName = formState.cardholderName.trim()
  const cardLast4 = digits.slice(-4)
  const summaryKey = `${cleanName}|${brand}|${cardLast4}`

  if (!paymentAttemptId.value || (submittedSummaryKey.value !== null && submittedSummaryKey.value !== summaryKey)) {
    paymentAttemptId.value = createAttemptId()
  }
  submittedSummaryKey.value = summaryKey

  submitting.value = true
  submitErrorKey.value = null

  try {
    const res = await finesStore.payFine({
      fineId: props.fine.id,
      cardholderName: cleanName,
      cardBrand: brand,
      cardLast4,
      paymentAttemptId: paymentAttemptId.value,
    })
    handleSuccessClose(res.paymentReference)
  }
  catch (err: unknown) {
    submitting.value = false
    if (reconcileLiveFine()) return

    const code = (err as { code?: string } | null)?.code
    const errorKey = mapServerErrorKey(code)
    submitErrorKey.value = errorKey
    toast.add({
      title: t('owner.fines.payment_modal.error_title'),
      description: t(errorKey),
      color: 'error',
    })
  }
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      lastKnownFine.value = props.fine
      if (!paymentAttemptId.value) {
        paymentAttemptId.value = createAttemptId()
      }
      submittedSummaryKey.value = null
      clearCardInputs()
    }
    else {
      submitting.value = false
      resetModalState()
    }
  },
  { immediate: true },
)

watch(
  () => props.fine?.id,
  (newId, oldId) => {
    if (open.value && newId && newId !== oldId) {
      lastKnownFine.value = props.fine
      paymentAttemptId.value = createAttemptId()
      submittedSummaryKey.value = null
      clearCardInputs()
    }
  },
)

watch(
  [() => props.fine, () => props.loading, submitting],
  () => {
    if (open.value && props.fine) {
      lastKnownFine.value = props.fine
    }
    if (!open.value || submitting.value) return
    reconcileLiveFine()
  },
)

onBeforeUnmount(() => {
  submitting.value = false
  resetModalState()
})
</script>
