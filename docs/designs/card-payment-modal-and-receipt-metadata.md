# ParkAlert Card Payment Modal & Receipt Metadata Persistence

*   **Author:** BrahimMasmoudi
*   **Status:** Proposed
*   **Date:** 2026-11-24

--------------------------------------------------------------------------------

## Overview

Vehicle owners in ParkAlert currently settle parking fines through a single-click button on `OwnerFineCard.vue` that immediately marks the fine as paid without confirming intent, validating card details, or recording receipt metadata. This design introduces a Nuxt UI (`@nuxt/ui` v4.12.2) card-payment modal workflow across English (`en`), French (`fr`), and Arabic (`ar` RTL) locales, and updates the `payFine` backend path to validate and store non-sensitive receipt metadata (`paidAt`, `paymentReference`, `paymentProvider`, and an owner-only masked card summary) for an upcoming receipt-download feature. No live payment processor (such as Stripe or a local Tunisian gateway) is connected in this phase; the modal operates in simulated-payment mode and never transmits or stores full card numbers, expiration dates, or CVVs.

--------------------------------------------------------------------------------

## The Problem

Today, clicking the pay button in `front/app/components/molecules/OwnerFineCard.vue` triggers `finesStore.payFine(fine.id)`, which calls the `payFine` Cloud Function and flips `status` to `'paid'` with no confirmation or card-entry step. This leaves four issues:

1.  **No checkout confirmation or schema validation:** Owners can trigger an irreversible payment transition with a single accidental tap, and the UI lacks a card-entry and validation workflow.
2.  **Missing receipt metadata:** `PayFineUseCase` returns only `{ ok: true }` and records no `paymentReference`, `paymentProvider`, or masked card summary, while `front/app/stores/fines.ts` omits `paidAt` from its normalized `Fine` model. A planned receipt-download feature cannot extract payment proof from existing records.
3.  **Unsafe backend boundary:** The `payFine` callable spreads `request.data` directly into `PayFineUseCase` without field allowlisting, and `PayFineUseCase` rejects retries after a post-commit network timeout because `status === 'paid'` throws `FAILED_PRECONDITION` unconditionally.
4.  **UI lifecycle coupling and privacy risks:** `OwnerFinesTab.vue` splits unpaid and paid fines into separate VueFire-backed `v-for` lists, so mounting a modal inside `OwnerFineCard.vue` causes VueFire to unmount the card while closing when a fine turns `paid`. Meanwhile, `finesStore.acting` locks all fine cards globally, `finesStore.payFine` emits hardcoded English toasts, and storing `cardholderName` directly on `fines/{fineId}` or `enforcement_audit_logs` would expose payer names to police queries (`allFinesQuery` in `front/app/stores/fines.ts`) or immutable append-only audit logs.

--------------------------------------------------------------------------------

## Goals

*   Require vehicle owners to complete and confirm a Nuxt UI card-payment modal (cardholder name, Luhn-valid card number for `visa`, `mastercard`, `amex`, or `discover`, non-expired `MM/YY`, and matching CVV) before calling `payFine`.
*   Support English (`en`), French (`fr`), and Arabic (`ar` RTL) localization while forcing left-to-right (`LTR`) display on card number, expiry, and CVV inputs, and showing a notice stating that payment is simulated and no real charge occurs.
*   Disable confirm, cancel, header close, backdrop click, and `Escape` dismissal while a submission is running, bounded by a 20-second request timeout.
*   Keep entered card inputs intact when `payFine` fails so the user can retry without retyping; close and clear all card fields on success, cancel, or dismiss; and display a single localized toast on success or failure (stacked above modal overlays via the app-root `<UToaster>`).
*   Transmit only non-sensitive summary fields (`cardholderName`, `cardBrand`, `cardLast4`) plus an attempt idempotency key (`paymentAttemptId`) to `payFine`, rejecting any non-allowlisted payload keys (including raw PAN, expiry, or CVV fields) if sent.
*   Persist `paidAt`, `paymentReference`, `paymentProvider`, and `paymentAttemptId` on `Fine`, non-PII payment audit metadata on `enforcement_audit_logs`, and owner-only masked card summary (`cardholderName`, `cardBrand`, `cardLast4`) under `fines/{fineId}/receipt/summary`.
*   Keep card-entry state isolated inside the modal component and payment validation isolated inside pure domain/composable modules so a future real gateway can replace simulated capture without rewriting `OwnerFineCard.vue` or fine-settlement rules.

--------------------------------------------------------------------------------

## Non-Goals

*   Integrating a live payment processor (Stripe, Konnect, Clictopay), executing real card charges, or handling 3D Secure redirects and asynchronous payment webhooks.
*   Storing or logging full card numbers (PAN), expiration dates, or CVVs in Firestore, Pinia stores, browser storage, or Cloud Logging.
*   Writing `cardholderName` to `fines/{fineId}`, `enforcement_audit_logs`, or Cloud Logging.
*   Accepting arbitrary or unrecognized BIN prefixes outside `visa`, `mastercard`, `amex`, and `discover`.
*   Implementing the receipt download UI (PDF/HTML generation) or multi-fine batch checkout.

--------------------------------------------------------------------------------

## Open Questions

None. Coordinated deployment with mandatory payment summary fields (`cardholderName`, `cardBrand`, `cardLast4`, and `paymentAttemptId`) is confirmed.

--------------------------------------------------------------------------------

## Critical User Journeys (CUJs)

### CUJ 1: Successful Simulated Fine Payment
*   **Given**: An authenticated vehicle owner views an unpaid, non-disputed fine on the Owner Fines tab.
*   **When**: The owner clicks Pay, reviews the fine summary (plate number, short reference, `TND` amount) and simulated-payment notice, enters valid card details, and submits Confirm Payment.
*   **Then**: Modal controls and dismissal paths lock for up to 20 seconds while `payFine` executes. On commit, the fine transitions to `paid` with `paidAt`, `paymentReference`, `paymentProvider`, and `paymentAttemptId`; the owner-only receipt subdocument and non-PII audit log are written; all card inputs clear from memory; the modal closes; and one localized success toast appears.

### CUJ 2: Card Schema & RTL/LTR Validation
*   **Given**: The owner opens the payment modal in any supported locale (`en`, `fr`, or `ar`).
*   **When**: The owner interacts with cardholder name, card number, expiry, or CVV fields or submits invalid or unsupported card inputs (such as a failed Luhn check, unrecognized BIN, expired `MM/YY`, or 3-digit CVV for an Amex card).
*   **Then**: Card number, expiry, and CVV inputs remain `LTR` even in Arabic RTL mode, validation errors appear in the active locale only after field touch/blur or submit, and submission stays blocked until all rules pass.

### CUJ 3: Failure Preservation, Retry Idempotency, & Cancel Reset
*   **Given**: The owner enters valid card details and submits payment, or decides to exit before submitting.
*   **When**: The owner submits and the request fails or times out after 20 seconds (including a retry after a post-commit network timeout), or the owner clicks Cancel, `X`, backdrop, or `Escape` when not submitting.
*   **Then**: `paymentAttemptId` is generated once on modal open and stays constant across retries with unchanged card summary fields; if a failed attempt's summary (`cardholderName`, `cardBrand`, `cardLast4`) is edited before the next submit, a fresh `paymentAttemptId` is generated for the edited retry so a prior committed card cannot confirm a different card summary. On failure without a confirmed commit, controls unlock, entered card fields stay populated, and an inline alert plus one localized error toast appear. On unchanged retry after an already-committed attempt, `payFine` returns the existing `{ ok: true, paymentReference }` without rewriting state. On cancel or dismiss, the modal closes and clears all entered card inputs, errors, and session `paymentAttemptId`.

### CUJ 4: Stale Fine State & Real-Time Reconciliation
*   **Given**: The owner has the payment modal open while VueFire's real-time `ownerFinesQuery` listener streams updates to `myFines`.
*   **When**: The bound fine transitions away from payable (`status !== 'unpaid'` or `disputeStatus === 'pending'`, or disappears permanently once `finesLoading === false`) before submission, during submission, or after a failed/timed-out request.
*   **Then**: While `submitting === true` or `finesLoading === true`, UI stale-state warnings and input wipes wait until both settle (keeping the last known fine summary displayed). Once settled, reconciliation evaluates the latest live fine: if `liveFine.status === 'paid'` and `liveFine.paymentAttemptId === paymentAttemptId`, the modal treats the payment as confirmed (clearing card inputs, closing, and showing one success toast); for any other non-payable or permanently missing state, the modal wipes card inputs immediately, shows a localized warning, disables confirmation, and any backend attempt fails with `FAILED_PRECONDITION` (settled/cancelled/disputed), `NOT_FOUND` (deleted fine), or `PERMISSION_DENIED` (ownership change).

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

### 1. Frontend Architecture & Modal Lifecycle

#### Modal Hosting and Card Trigger
*   `OwnerFineCard.vue` emits a `pay` event with the `Fine` object when the Pay button is clicked, instead of calling `finesStore.payFine(fine.id)` directly. The Pay button drops its binding to `finesStore.acting` so opening or submitting payment for one fine never disables or spins buttons on unrelated fine cards (non-payment actions such as `disputeFine`, `issueFine`, and `resolveDispute` keep `finesStore.acting` and existing UI bindings outside this scope).
*   `OwnerFinesTab.vue` hosts a single `<OrganismsOwnerPayFineModal>` outside the `unpaidFines` / `paidFines` `v-for` lists, resolving `selectedPayFineId` against `props.fines` (`Fine[]`, fed by `ownerFinesQuery`, which fetches all owner fines regardless of `status`) so VueFire moving a fine from `unpaidFines` to `paidFines` upon payment does not unmount the open modal.

#### Nuxt UI Modal, Validation, & Submission Control
*   `OwnerPayFineModal.vue` composes Nuxt UI (`@nuxt/ui` v4.12.2) form and overlay primitives (`UModal`, `UForm`, `UFormField`, `UInput`, `UAlert`, `UButton`, `UBadge`).
*   Pure validation and formatting logic lives in a frontend composable (`front/app/composables/useCardValidation.ts`), matching the project's existing `useVehicleValidation.ts` pattern. It handles brand detection and digit/CVV rules (`visa`, `mastercard`, `amex`, `discover`), Luhn checksum, calendar `MM/YY` expiry bounds, and Unicode cardholder name length/character rules.
*   Card number, expiry, and CVV inputs enforce `LTR` alignment, numeric virtual keyboards, and browser `cc-*` autofill hints (`formatExpiry` normalizes browser-autofilled `MM/YYYY` or `YYYY-MM` formats alongside `MM/YY` typing); `cardholderName` uses automatic text direction. Validation errors render after field interaction (blur/touch) or submit, never on initial modal open.
*   Raw card state stays strictly inside component-local reactive state (never in Pinia, browser storage, error payloads, or logs) and is cleared on every close transition (`Cancel`, `Escape`, backdrop click, `X`, success, or unmount).
*   `OwnerPayFineModal.vue` owns a local `submitting` flag that locks all modal buttons and dismissal paths (`dismissible` and header close button) during submission.
*   `finesStore.payFine` stops toggling `finesStore.acting` and stops emitting hardcoded English `toast.add(...)` calls. Instead, it invokes the `payFine` callable with a 20-second Firebase SDK timeout (`httpsCallable(..., { timeout: 20_000 })`) and returns `{ ok: true, paymentReference }` or throws `FunctionsError` / `Error`. `OwnerPayFineModal.vue` invokes Nuxt UI `useToast()` targeting the app-root `<UToaster>` mounted by `<UApp>` in `front/app/app.vue`, and maps Firebase `'functions/...'` error codes to inline localized alerts.

### 2. Backend Architecture, Privacy Boundary, & Persistence

#### Entry Point & Domain Validation
*   `functions/src/infrastructure/entry-points/fine/pay-fine.ts` replaces `...(request.data ?? {})` with plain-object validation and a strict 5-key allowlist check for `{ fineId, cardholderName, cardBrand, cardLast4, paymentAttemptId }`. Requests that are not plain objects or contain any non-allowlisted key (including raw card fields such as `cardNumber`, `pan`, `cvv`, `cvc`, `expiry`, `expMonth`, `expYear`, or client-supplied `userId`) fail immediately with `HttpsError('invalid-argument', 'Invalid payment payload')` inside the handler, without logging `request.data` values.
*   `functions/src/domain/value-objects/payment.ts` defines the canonical `CardBrand` union, validators enforcing shared client/server bounds (`cardholderName`: trimmed 2–100 chars across Unicode letters/spaces/punctuation with no ASCII control chars; `cardBrand`: `visa | mastercard | amex | discover`; `cardLast4`: 4 ASCII digits; `paymentAttemptId`: 8–64 `[A-Za-z0-9_-]` token chars), and CSPRNG `node:crypto` `paymentReference` generation (`PA-YYYYMMDD-<12 uppercase hex chars>` using server UTC date).
*   `PayFineUseCase` validates all input fields directly via `domain/value-objects/payment.ts` before starting the Firestore transaction, matching existing `DisputeFineUseCase` (which validates inputs via domain value objects immediately before `transactionRunner.run(...)`).

#### Transactional Writes & Idempotency
*   Inside `PayFineUseCase.execute()`, after pre-transaction input validation:
    1.  Read `fine` (`fineRepository.getById(fineId, tx)`) and verify existence (`NOT_FOUND`), ownership (`PERMISSION_DENIED`), not cancelled (`FAILED_PRECONDITION`), and no pending dispute (`FAILED_PRECONDITION`).
    2.  If `fine.status === 'paid'`, check whether `fine.paymentAttemptId === request.paymentAttemptId` and `fine.paymentReference` is present. On a match, return `{ ok: true, paymentReference: fine.paymentReference }` without rewriting state; otherwise throw `FAILED_PRECONDITION`.
    3.  If `fine.reportId` is set (linking a `Fine` back to the originating parking-violation `Report`, whose entity module also co-locates `EnforcementAuditLog`), read `linkedReport` (`reportRepository.getById(fine.reportId, tx)`) during the read phase *before* any Firestore writes so existing settlement resolution (`status: 'resolved'`) satisfies Firestore's read-before-write transaction rule.
    4.  Perform all atomic writes: update `fines/{fineId}` (`status: 'paid'`, `paymentReference`, `paymentProvider: 'simulated'`, `paymentAttemptId`, plus `FirestoreFineRepository.update()`'s existing `paidAt` server timestamp), call `fineRepository.setReceiptSummary(fineId, { cardholderName, cardBrand, cardLast4 }, tx)` to write `fines/{fineId}/receipt/summary`, mark `linkedReport` `'resolved'` if present, and append a non-PII `PAY_FINE` record (`targetType`, `targetId`, `actorId`, `action`, `paymentReference`, `paymentProvider`, `timestamp`) to `enforcement_audit_logs`.
*   `PayFineUseCase` emits structured `logger.info` on success without `cardholderName` or card secrets; `pay-fine.ts` propagates errors via `mapDomainErrorToHttpsError(error)` matching sibling fine entry points (`dispute-fine.ts`, `issue-fine.ts`, `resolve-dispute.ts`).

#### Firestore Rules & Client Normalization
*   `firestore.rules` adds a read rule scoped to `match /fines/{fineId}/receipt/summary` checking `isSecureRequest() && hasRole('owner')` (the existing authenticated-user and `'owner'`-role predicates in `firestore.rules`) plus parent document ownership (`exists(/databases/$(database)/documents/fines/$(fineId)) && 'ownerId' in get(/databases/$(database)/documents/fines/$(fineId)).data && get(/databases/$(database)/documents/fines/$(fineId)).data.ownerId == request.auth.uid`), with all client writes denied. Authorizing via the parent document ensures reading a missing receipt document on unpaid or legacy paid fines resolves as non-existent (`snap.exists() === false`) rather than `PERMISSION_DENIED`.
*   `front/app/stores/fines.ts` extends `Fine` and `normalizeFineFromFirestore()` with optional `paidAt`, `paymentReference`, `paymentProvider`, and `paymentAttemptId`. Because `getTimestampMillis` falls back to `Date.now()` on falsy inputs, `normalizeFineFromFirestore()` guards `data.paidAt` so missing or unresolved timestamps stay `undefined`.

### 3. End-to-End Payment Flow

```mermaid
sequenceDiagram
    actor Owner
    participant Card as OwnerFineCard.vue
    participant TabModal as OwnerFinesTab / OwnerPayFineModal
    participant Store as useFinesStore.payFine
    participant CF as payFine (onCall)
    participant UC as PayFineUseCase
    participant DB as Firestore (Tx)

    Owner->>Card: Click Pay
    Card->>TabModal: emit('pay', fine)
    Owner->>TabModal: Enter card fields & Confirm
    TabModal->>TabModal: Validate Luhn, Brand, MM/YY, CVV (client-only)
    Note over TabModal: submitting=true; lock buttons, backdrop, Escape, X
    TabModal->>Store: payFine({ fineId, cardholderName, cardBrand, cardLast4, paymentAttemptId })
    Store->>CF: httpsCallable('payFine', { timeout: 20_000 })
    CF->>CF: Plain-object & strict 5-key allowlist check (reject non-allowlisted keys)
    CF->>UC: execute(validated request)
    UC->>UC: Pre-tx domain validation (payment.ts)
    UC->>DB: Tx Reads: fine + linked report
    alt Matching retry on already-paid fine
        UC-->>CF: { ok: true, paymentReference }
    else Unpaid payable fine
        UC->>DB: Tx Writes: fines/{fineId}, fines/{fineId}/receipt/summary, report, audit log
        UC-->>CF: { ok: true, paymentReference }
    end
    CF-->>Store: { ok: true, paymentReference }
    alt Success (or liveFine.paymentAttemptId match after error)
        TabModal->>TabModal: Wipe raw card fields & close
        TabModal->>Owner: Single localized success toast via useToast() (root UToaster)
    else Error / Timeout (not yet paid)
        Note over TabModal: Unlock controls, preserve fields (or wipe if non-payable)
        TabModal->>Owner: Inline UAlert + localized error toast via useToast()
    end
```

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative A: Minimal Confirmation `UModal` Without Card Fields
*   **Pros**: Minimal UI surface, no Luhn/BIN validation code, and no disposable card inputs once a hosted gateway (such as Stripe Elements or Konnect) is added.
*   **Cons**: Provides no card-input UX, schema validation, or simulated card summary metadata for testing the upcoming receipt feature.
*   **Reason for Rejection**: The product requires exercising card-schema validation and recording payment summary metadata ahead of the upcoming receipt-download feature.

### Alternative B: Frontend-Only Card Validation With Untouched `payFine({ fineId })` Backend
*   **Pros**: No backend or Firestore schema changes and no deployment-skew risk between frontend and Cloud Functions.
*   **Cons**: Leaves `payFine` without `paymentReference`, `paymentProvider`, or masked card summary metadata, blocking the planned receipt-download feature and leaving `request.data` unvalidated.
*   **Reason for Rejection**: The upcoming receipt-download feature requires reading saved payment metadata from Firestore.

### Alternative C: Third-Party Card-Input Package
*   **Pros**: Pre-built card formatting, brand icons, and validation helpers out of the box.
*   **Cons**: Adds an external dependency outside `@nuxt/ui` v4.12.2, complicates RTL/LTR styling alignment with existing Nuxt UI form fields, and still does not provide PCI-compliant tokenization without a gateway.
*   **Reason for Rejection**: Keeping `@nuxt/ui` v4.12.2 consistent across the app avoids adding extra runtime dependencies for simulated entry.

### Alternative D: Storing `cardholderName` Directly on `fines/{fineId}` and `enforcement_audit_logs`
*   **Pros**: Avoids adding a `receipt/summary` subdocument and a new `firestore.rules` match block; a single document read loads both fine and cardholder details.
*   **Cons**: Under `firestore.rules`, police users read all `fines/{fineId}` documents (`allFinesQuery`), exposing payer names on police dashboards, while `enforcement_audit_logs` is immutable and append-only (`allow read, write: if false`).
*   **Reason for Rejection**: Storing only `{ cardholderName, cardBrand, cardLast4 }` in an owner-only subdocument (`fines/{fineId}/receipt/summary`) keeps payer PII hidden from police queries and immutable audit logs without duplicating `Fine` fields.

### Alternative E: Mounting the Payment Modal Inside `OwnerFineCard.vue`
*   **Pros**: Matches the inline `isDisputeOpen` modal pattern already used for fine disputes on `OwnerFineCard.vue`.
*   **Cons**: `OwnerFinesTab.vue` renders `unpaidFines` and `paidFines` in separate `v-for` lists, so VueFire unmounts the card—and any inline modal—as soon as `status` flips to `'paid'`, interrupting close transitions and toast feedback.
*   **Reason for Rejection**: Hoisting a single modal into `OwnerFinesTab.vue` avoids VueFire unmount races and prevents mounting duplicate modals across list items.

### Alternative F: Permitting Unknown Luhn-Valid BINs as `'other'`
*   **Pros**: Lets testers enter arbitrary Luhn-valid digits regardless of BIN prefix and covers unrecognized local card ranges automatically.
*   **Cons**: Accepts invalid prefixes that standard card networks reject and blurs brand-specific digit/CVV validation rules.
*   **Reason for Rejection**: Strict brand matching against `visa`, `mastercard`, `amex`, and `discover` enforces realistic card-network length and CVV validation rules.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Security & Privacy**:
    *   Full card numbers (PAN), expiration dates, and CVVs remain in component-local Vue state only, are cleared on close/unmount, and are rejected by `payFine` if included in the callable payload.
    *   `cardholderName` is stored exclusively in `fines/{fineId}/receipt/summary` (readable only by the owning user via parent `fines/{fineId}` ownership verification) and omitted from `fines/{fineId}`, `enforcement_audit_logs`, and Cloud Logging.
    *   All `payFine` callable invocations require Firebase Auth and App Check (`enforceAppCheck: true`).
*   **Performance & Latency**:
    *   `paymentReference` (`PA-YYYYMMDD-<12 uppercase hex chars>`) is generated statelessly via CSPRNG (`node:crypto`) using server UTC date inside `PayFineUseCase`, avoiding sequential Firestore counter contention.
    *   Client submission enforces a 20-second `httpsCallable` timeout so stalled requests unlock the modal, preserve entered fields, and allow idempotent retry.
*   **Rollout & Compatibility**:
    *   Deploy Cloud Functions and `firestore.rules` alongside or immediately before the updated SPA build (`ssr: false`). Unrefreshed already-open SPA tabs sending legacy `{ fineId }` fail with `'functions/invalid-argument'` and show their existing generic store error toast until manually reloaded; updated clients send the 5-key allowlist and surface localized guidance if `'functions/invalid-argument'` occurs. Rolling back the SPA alone requires rolling back `payFine` as well because legacy payloads fail strict backend validation.
    *   Historical `paid` fines created before this change lack `paymentReference`, `paymentProvider`, `paymentAttemptId`, and `receipt/summary` documents; `normalizeFineFromFirestore()` guards `paidAt` against falsy values so legacy records do not render `Date.now()`.

--------------------------------------------------------------------------------

## Risks & Mitigations

*   **Deployment Skew (SPA vs. Strict Callable):** Already-open, unrefreshed SPA tabs during rollout will fail with `'functions/invalid-argument'` once the updated `payFine` Cloud Function deploys. *Mitigation:* Deploy backend and frontend together in a short, coordinated release window; unrefreshed tabs recover once reloaded.
*   **Timeout / Commit Divergence & Real-Time Snapshot Race:** A payment transaction may commit on the backend after the 20-second client timeout fires, or VueFire may push `status: 'paid'` / another non-payable state while `submitting` is `true`. *Mitigation:* Retain `paymentAttemptId` across identical-card retries (rotating `paymentAttemptId` on submit if card summary fields change after an attempt) for server idempotency and client reconciliation (`liveFine.paymentAttemptId === paymentAttemptId`), and reconcile all non-payable states once `submitting` and `finesLoading` settle.
*   **Unverified Simulated Submissions:** Because no external gateway authorizes charges in this phase, simulated mode intentionally accepts authenticated owner invocations passing App Check (`enforceAppCheck: true`), ownership, precondition, and allowlisted summary validation, tagging settled records with `paymentProvider: 'simulated'` for audit separation once a live payment gateway is integrated.
*   **Legacy Paid Fines Missing Receipt Documents:** Historical `paid` fines lack `receipt/summary` subdocuments and `paymentReference`. *Mitigation:* Authorize `fines/{fineId}/receipt/summary` reads via parent `fines/{fineId}` ownership so missing receipt reads resolve as non-existent (`snap.exists() === false`) without `PERMISSION_DENIED`, and keep receipt UI fields optional.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Target Scope & File Boundary
Only the following files are created or modified for this feature:
*   **Backend:** `functions/src/domain/value-objects/payment.ts` (create), `functions/src/domain/entities/fine.entity.ts`, `functions/src/domain/entities/report.entity.ts`, `functions/src/domain/repositories/fine.repository.ts`, `functions/src/infrastructure/adapters/persistence/FirestoreFineRepository.ts`, `functions/src/application/usecases/fine/pay-fine.ts`, `functions/src/infrastructure/entry-points/fine/pay-fine.ts`, `functions/tests/unit/pay-fine.spec.ts`
*   **Rules & Emulator:** `firestore.rules`, `functions/tests/emulator/firestore-rules.spec.ts`
*   **Frontend:** `front/app/composables/useCardValidation.ts` (create), `front/app/stores/fines.ts`, `front/app/components/organisms/OwnerPayFineModal.vue` (create), `front/app/components/molecules/OwnerFineCard.vue`, `front/app/components/organisms/OwnerFinesTab.vue`, `front/i18n/locales/en.json`, `front/i18n/locales/fr.json`, `front/i18n/locales/ar.json`, `front/tests/cardValidation.test.ts` (create), `front/tests/fineConverter.test.ts`

### Phase 1: Backend Domain, Persistence, Use Case, Entry Point, & Unit Tests

#### 1. `functions/src/domain/value-objects/payment.ts` (Create)
*   **Type / Scope**: Backend Domain Value Object
*   **Proposed Changes**:
    *   Export `CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover'` and `CARD_BRANDS = ['visa', 'mastercard', 'amex', 'discover'] as const`.
    *   Implement pure validators throwing `DomainError('INVALID_ARGUMENT', ...)` on failure:
        *   `validateCardholderName(value: unknown): string` — requires a string, trims surrounding whitespace, enforces length 2–100 and rejects ASCII control characters via character-code bounds (`code < 0x20 || code === 0x7f` for ESLint `no-control-regex` compatibility); returns the trimmed string.
        *   `validateCardBrand(value: unknown): CardBrand` — requires exact lowercase match in `CARD_BRANDS`.
        *   `validateCardLast4(value: unknown): string` — requires a 4-digit ASCII numeric string.
        *   `validatePaymentAttemptId(value: unknown): string` — requires an `[A-Za-z0-9_-]` string of length 8–64.
    *   Implement `generatePaymentReference(now: Date = new Date()): string` producing `PA-YYYYMMDD-<12 uppercase hex chars>` using the server UTC calendar date and CSPRNG (`node:crypto`) bytes.

#### 2. `functions/src/domain/entities/fine.entity.ts` (Modify)
*   **Type / Scope**: Backend Domain Entity
*   **Proposed Changes**:
    *   Extend `Fine` with optional `paymentReference?: string`, `paymentProvider?: 'simulated'`, and `paymentAttemptId?: string`.
    *   Add `FineReceiptSummary` interface containing only the owner-private masked card fields: `{ cardholderName: string; cardBrand: CardBrand; cardLast4: string }`.

#### 3. `functions/src/domain/entities/report.entity.ts` (Modify)
*   **Type / Scope**: Backend Domain Entity (co-locating `Report` and `EnforcementAuditLog`)
*   **Proposed Changes**:
    *   Extend `EnforcementAuditLog` with optional non-PII payment fields: `paymentReference?: string` and `paymentProvider?: string`. Keep `cardholderName`, `paymentAttemptId`, `cardBrand`, and `cardLast4` absent.

#### 4. `functions/src/domain/repositories/fine.repository.ts` (Modify)
*   **Type / Scope**: Backend Domain Repository Port
*   **Proposed Changes**:
    *   Add `setReceiptSummary(fineId: string, receipt: FineReceiptSummary, txOrBatch?: TransactionContext): Promise<void>` to `FineRepository`.

#### 5. `functions/src/infrastructure/adapters/persistence/FirestoreFineRepository.ts` (Modify)
*   **Type / Scope**: Backend Persistence Adapter
*   **Proposed Changes**:
    *   Implement `setReceiptSummary(fineId, receipt, txOrBatch)` writing `{ cardholderName, cardBrand, cardLast4 }` to `fines/{fineId}/receipt/summary` within the active transaction when provided (or directly via doc ref outside transactions).
    *   Preserve the existing `paidAt` `serverTimestamp()` auto-injection inside `update()` when `updates.status === 'paid'`.

#### 6. `functions/src/application/usecases/fine/pay-fine.ts` (Modify)
*   **Type / Scope**: Backend Application Use Case
*   **Proposed Changes**:
    *   Update `PayFineRequest` to require `{ fineId: string; userId: string; cardholderName: string; cardBrand: CardBrand; cardLast4: string; paymentAttemptId: string }`.
    *   Keep the existing 4-parameter constructor (`fineRepository`, `reportRepository`, `enforcementAuditPort`, `transactionRunner`).
    *   Update `execute()` return type to `Promise<{ ok: true; paymentReference: string }>`.
    *   **Pre-transaction validation:** Before calling `transactionRunner.run(...)`, verify `fineId` and `userId` are non-empty strings and validate `{ cardholderName, cardBrand, cardLast4, paymentAttemptId }` via `domain/value-objects/payment.ts` (throwing `DomainError('INVALID_ARGUMENT', ...)`), using the validated values in all subsequent writes.
    *   **Transaction Read Phase:** Inside `transactionRunner.run(async (tx) => ...)`, read `fine = await this.fineRepository.getById(fineId, tx)` and verify:
        *   `!fine` → `DomainError('NOT_FOUND', 'Fine not found')`
        *   `fine.ownerId !== userId` → `DomainError('PERMISSION_DENIED', 'You can only pay your own fines')`
        *   `fine.status === 'cancelled'` → `DomainError('FAILED_PRECONDITION', 'Cancelled fines cannot be paid')`
        *   `fine.disputeStatus === 'pending'` → `DomainError('FAILED_PRECONDITION', 'Fines under active dispute cannot be paid')`
        *   If `fine.status === 'paid'`: if `fine.paymentAttemptId === paymentAttemptId && Boolean(fine.paymentReference)`, return `{ ok: true, paymentReference: fine.paymentReference! }` immediately without writes; otherwise throw `DomainError('FAILED_PRECONDITION', 'This fine is already paid')`.
        *   Read `linkedReport = fine.reportId ? await this.reportRepository.getById(fine.reportId, tx) : null` *before* any writes (preserving existing violation-report `'resolved'` settlement semantics).
    *   **Transaction Write Phase:**
        *   Generate `paymentReference = generatePaymentReference()`.
        *   Call `fineRepository.update(fineId, { status: 'paid', paymentReference, paymentProvider: 'simulated', paymentAttemptId }, tx)`.
        *   Call `fineRepository.setReceiptSummary(fineId, { cardholderName, cardBrand, cardLast4 }, tx)` to persist the owner-only card summary.
        *   Update `linkedReport` to `'resolved'` if present.
        *   Append `PAY_FINE` audit log: `{ targetType: 'fine', targetId: fineId, actorId: userId, action: 'PAY_FINE', paymentReference, paymentProvider: 'simulated', timestamp: new Date() }`.
    *   Emit `logger.info('Fine paid', { fineId, reportId: fine.reportId, actorId: userId, action: 'PAY_FINE', paymentReference, paymentProvider: 'simulated', paymentAttemptId })` — never logging `cardholderName` or raw card secrets.

#### 7. `functions/src/infrastructure/entry-points/fine/pay-fine.ts` (Modify)
*   **Type / Scope**: Backend Cloud Function Entry Point
*   **Proposed Changes**:
    *   Inside the existing `try/catch` block matching sibling fine entry points (`dispute-fine.ts`, `issue-fine.ts`, `resolve-dispute.ts`):
        *   Verify `request.data` is a non-null plain object (not array/primitive) and verify every own key is in the strict allowlist `{ fineId, cardholderName, cardBrand, cardLast4, paymentAttemptId }`; on any invalid shape or unexpected key (including raw PAN/CVV/expiry fields or client-supplied `userId`), throw `HttpsError('invalid-argument', 'Invalid payment payload')` without logging `request.data` values.
        *   Narrow verified own fields from `request.data` to typed strings (`PayFineRequest`) cleanly under `"strict": true` (removing `...(request.data ?? {})` spread) and invoke `payFineUseCase.execute(...)` with `userId: request.auth.uid`.
    *   In `catch (error: unknown)`: delegate directly to `throw mapDomainErrorToHttpsError(error)` (`shared/error-mapper.ts`, which passes `HttpsError` instances through unchanged).

#### 8. `functions/tests/unit/pay-fine.spec.ts` (Modify)
*   **Type / Scope**: Backend Unit Tests
*   **Proposed Changes**:
    *   Update the entry-point mock and `makeUseCase()` helper to stub `setReceiptSummary` on `fineRepository` and supply valid payment summary fields in existing test fixtures:
        *   Update the existing `rejectedDispute` expectation from `{ ok: true }` to `{ ok: true, paymentReference }`.
        *   In `'derives userId from auth context rather than client payload on payFine callable'`, remove `userId: 'owner-1'` from `data` (passing only the 5 allowlisted fields) so ownership mismatch continues verifying `'permission-denied'`, and add an assertion verifying that passing `userId` in `data` rejects at the allowlist check with `'invalid-argument'`.
    *   Add unit test coverage for:
        *   Valid payment setting `Fine` settlement metadata (`status`, formatted `paymentReference`, `paymentProvider: 'simulated'`, `paymentAttemptId`), calling `setReceiptSummary` with `{ cardholderName, cardBrand, cardLast4 }`, resolving linked report, and writing non-PII `PAY_FINE` audit log with `paymentReference` and `paymentProvider`.
        *   Idempotent retry when `fine.status === 'paid'` and `paymentAttemptId` matches with existing `paymentReference` (returns `{ ok: true, paymentReference }` with no writes).
        *   `FAILED_PRECONDITION` when `fine.status === 'paid'` and `paymentAttemptId` mismatches or `fine.paymentReference` is missing.
        *   `NOT_FOUND` for missing fine; `INVALID_ARGUMENT` for invalid `cardholderName`, `cardBrand`, `cardLast4`, `paymentAttemptId` (`DomainError`); and `'invalid-argument'` (`HttpsError`) for non-plain-object `request.data`, unexpected extra keys, and raw card keys (`cardNumber`, `pan`, `cvv`, `cvc`, `expiry`, `expMonth`, `expYear`).
        *   Verify `PayFineUseCase` `logger.info` payload never includes `cardholderName` or raw card secrets.
        *   Unit test coverage for `FirestoreFineRepository.setReceiptSummary` verifying transactional writes to `fines/{fineId}/receipt/summary` with `{ cardholderName, cardBrand, cardLast4 }`.

---

### Phase 2: Firestore Security Rules & Emulator Tests

#### 9. `firestore.rules` (Modify)
*   **Type / Scope**: Firestore Security Rules
*   **Proposed Changes**:
    *   Under `match /fines/{fineId}`, add least-privilege summary matching:
        ```
        match /receipt/summary {
          allow read: if isSecureRequest() && hasRole('owner') &&
            exists(/databases/$(database)/documents/fines/$(fineId)) &&
            'ownerId' in get(/databases/$(database)/documents/fines/$(fineId)).data &&
            get(/databases/$(database)/documents/fines/$(fineId)).data.ownerId == request.auth.uid;
          allow write: if false;
        }
        ```
    *   Keep police read access scoped to `fines/{fineId}` only (`allFinesQuery` remains unable to read `receipt/summary`).

#### 10. `functions/tests/emulator/firestore-rules.spec.ts` (Modify)
*   **Type / Scope**: Security Rules Emulator Tests
*   **Proposed Changes**:
    *   Verify the owning user (`owner` role + `fines/{fineId}.ownerId == uid`) can read `fines/{fineId}/receipt/summary` when present and gets `snap.exists() === false` (calling `DocumentSnapshot.exists()`, not `PERMISSION_DENIED`) when missing on unpaid or legacy paid fines.
    *   Verify another `owner` user cannot read `fines/{fineId}/receipt/summary`.
    *   Add a police-only user fixture (`roles: ['police']`, without `'owner'`) distinct from the existing dual-role `['police', 'owner']` fixture and verify `police` cannot read `fines/{fineId}/receipt/summary`.
    *   Verify all client writes (`create`, `update`, `delete`) to `fines/{fineId}/receipt/summary` are denied.

---

### Phase 3: Frontend Validation, Store, Modal/Card/Tab UI, i18n, & Tests

#### 11. `front/app/composables/useCardValidation.ts` (Create)
*   **Type / Scope**: Frontend Validation Composable & Pure Helpers
*   **Proposed Changes**:
    *   Export `CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover'` and `type CardErrorKey = string | null`.
    *   Export pure helpers (importable directly by Vitest without Vue setup, matching `useVehicleValidation.ts`):
        *   `stripCardDigits(value: string): string`
        *   `detectCardBrand(digits: string): CardBrand | null`:
            *   `'amex'`: starts with `34` or `37`
            *   `'visa'`: starts with `4`
            *   `'mastercard'`: 2-digit prefix `51`–`55`, or 4-digit prefix `2221`–`2720` (for partial inputs under 4 digits starting with `2`, return `null` until 4 digits clarify `2221`–`2720`)
            *   `'discover'`: starts with `6011`, `65`, or 3-digit prefix `644`–`649` (for partial inputs starting with `64` under 3 digits or `60` under 4 digits, return `null` until prefix resolves)
            *   Returns `null` otherwise.
        *   `getCardRule(brand: CardBrand)`: returns `{ lengths: number[]; cvvLength: 3 | 4; groups: number[] }` (`visa`: `[13, 16, 19]`, CVV `3`, `[4,4,4,4,3]`; `mastercard`: `[16]`, CVV `3`, `[4,4,4,4]`; `amex`: `[15]`, CVV `4`, `[4,6,5]`; `discover`: `[16]`, CVV `3`, `[4,4,4,4]`).
        *   `formatCardNumber(value: string): string` — strips non-digits, detects brand, caps digits at 19 when `brand === null` or max supported length for known brands, and formats in `4-6-5` groups for Amex or 4-digit space-separated groups otherwise.
        *   `formatExpiry(value: string): string` — handles typed digits and browser-autofilled `MM/YYYY` / `YYYY-MM` formats, normalizing to `MM/YY` (`<= 4` digits with `/` after month).
        *   `luhnCheck(digits: string): boolean` — standard Mod-10 check on non-empty numeric digits.
        *   `validateCardholderName(value: string): CardErrorKey` — requires trimmed length 2–100 and rejects ASCII control characters via character-code checks (`code < 0x20 || code === 0x7f` for ESLint `no-control-regex` compatibility); returns `'owner.fines.payment_modal.errors.cardholder_required'` or `'owner.fines.payment_modal.errors.cardholder_invalid'`.
        *   `validateCardNumber(value: string): CardErrorKey` — returns `null` if `brand !== null`, `rule.lengths.includes(digits.length)`, and `luhnCheck(digits)`; otherwise returns `'owner.fines.payment_modal.errors.card_number_required'` (empty), `'owner.fines.payment_modal.errors.card_brand_unsupported'` (when entered digits rule out all supported BIN prefixes — at `>= 4` digits for 4-digit ranges such as `2221`–`2720` / `6011`, `>= 3` digits for `644`–`649`, or once a leading prefix cannot match `visa`, `mastercard`, `amex`, or `discover`), or `'owner.fines.payment_modal.errors.card_number_invalid'`.
        *   `validateExpiry(value: string, referenceDate: Date = new Date()): CardErrorKey` — parses `MM/YY` via `2000 + Number(yy)` against local calendar month/year (`referenceDate.getFullYear()`, `referenceDate.getMonth() + 1`); requires `MM` in `01..12` and `year <= curYear + 20` (returning `'owner.fines.payment_modal.errors.expiry_format'` if violated, including years beyond `+20`), and non-expired (`year > curYear || (year === curYear && month >= curMonth)`, else `'owner.fines.payment_modal.errors.expiry_expired'`); empty input returns `'owner.fines.payment_modal.errors.expiry_required'`.
        *   `validateCvv(value: string, brand: CardBrand | null): CardErrorKey` — requires numeric digits matching `brand === 'amex' ? 4 : 3` (`'owner.fines.payment_modal.errors.cvv_required'` or `'owner.fines.payment_modal.errors.cvv_invalid'`).
    *   Export `useCardValidation()` returning the helpers above.

#### 12. `front/app/stores/fines.ts` (Modify)
*   **Type / Scope**: Frontend Pinia Store
*   **Proposed Changes**:
    *   Extend `Fine` interface with optional `paidAt?: number`, `paymentReference?: string`, `paymentProvider?: string`, and `paymentAttemptId?: string`.
    *   Update `normalizeFineFromFirestore()` to populate:
        *   `paidAt: data.paidAt ? getTimestampMillis(data.paidAt) : undefined` (required because existing `getTimestampMillis` falls back to `Date.now()` on falsy inputs)
        *   `paymentReference: data.paymentReference`
        *   `paymentProvider: data.paymentProvider`
        *   `paymentAttemptId: data.paymentAttemptId`
    *   Update `payFine(payload: { fineId: string; cardholderName: string; cardBrand: CardBrand; cardLast4: string; paymentAttemptId: string }): Promise<{ ok: true; paymentReference: string }>`:
        *   Remove `acting.value = true/false` and stop catching errors into `toast.add(...)` (let callable errors propagate to `OwnerPayFineModal.vue`; keep non-payment store actions unchanged).
        *   Call `httpsCallable($functions, 'payFine', { timeout: 20_000 })(payload)` and return `result.data as { ok: true; paymentReference: string }`.

#### 13. `front/app/components/organisms/OwnerPayFineModal.vue` (Create)
*   **Type / Scope**: Frontend Organism Modal Component (`@nuxt/ui` v4.12.2)
*   **Proposed Changes**:
    *   Props / Model: `open = defineModel<boolean>('open', { required: true })`, `defineProps<{ fine: Fine | null; loading?: boolean }>()`. Maintain a cached `lastKnownFine` ref synced whenever `props.fine` is non-null while open so the fine summary stays stable during close animations or transient `loading === true` snapshots. No `'paid'` event is emitted because VueFire snapshot updates drive `OwnerFinesTab.vue`.
    *   **UI & Inputs:**
        *   `<UModal>` configured with `v-model:open="open"`, `:dismissible="!submitting"`, `:close="{ disabled: submitting }"`, localized `:title="$t('owner.fines.payment_modal.title')"`, and `:description="$t('owner.fines.payment_modal.subtitle')"`; body renders fine summary under `v-if="displayFine"` (`displayFine.plateNumber` `dir="ltr"`, short `#id`, `TND {{ displayFine.amount }}` `dir="ltr"`), simulated-payment `<UAlert>` notice, dedicated `<UAlert>` for `stale_fine_warning`, and `<UForm :id="PAYMENT_FORM_ID" :state="formState" @submit="handleSubmit">` (explicitly omitting `:validate` and `:schema`).
        *   Four `<UFormField>` + `<UInput>` fields inside `formState`: `cardholderName` (`dir="auto"`, `autocomplete="cc-name"`), `cardNumber` (`dir="ltr"`, numeric keyboard, `autocomplete="cc-number"`, formatted via `formatCardNumber` on `@update:model-value`, live detected brand badge), `expiry` (`dir="ltr"`, numeric keyboard, `autocomplete="cc-exp"`, `MM/YY` placeholder, normalized via `formatExpiry` on `@update:model-value`), and `cvv` (`type="password"`, `dir="ltr"`, numeric keyboard, `autocomplete="cc-csc"`, sanitized via `stripCardDigits` on `@update:model-value`). When sanitization leaves `formState` unchanged (e.g., typing letters into a numeric field), synchronize the DOM input value so rejected characters do not persist visually.
        *   `#footer`: Cancel `<UButton :disabled="submitting" @click="handleCancel">` labeled with `$t('common.cancel')` and Confirm `<UButton type="submit" :form="PAYMENT_FORM_ID" :loading="submitting" :disabled="submitting || isStaleNonPayable">`.
    *   **Validation, Session Attempt ID, & Stale Predicates:**
        *   Track `touched` per field (set on `@blur`); display field errors only when touched or `submitAttempted === true`.
        *   Generate `paymentAttemptId = crypto.randomUUID()` once on modal open (`open.value === true`) and retain `submittedSummaryKey` (from prior failed attempt's `{ cardholderName, cardBrand, cardLast4 }`). Keep the same `paymentAttemptId` when retrying unchanged summary inputs; if `{ cardholderName, cardBrand, cardLast4 }` changed since the prior attempt, generate a fresh `paymentAttemptId` right before dispatch so a prior committed card cannot confirm an edited card summary. Clear `paymentAttemptId` and `submittedSummaryKey` when closing or unmounting.
        *   Separate reconciliation predicates cleanly:
            *   `isOwnAttemptPaid = computed(() => Boolean(open.value && props.fine?.status === 'paid' && props.fine?.paymentAttemptId === paymentAttemptId.value))`
            *   `isStaleNonPayable = computed(() => Boolean(open.value && !submitting.value && !props.loading && !isOwnAttemptPaid.value && (!props.fine || props.fine.status !== 'unpaid' || props.fine.disputeStatus === 'pending')))` (driving both Confirm `:disabled` and dedicated `stale_fine_warning` `<UAlert>`).
    *   **Submission, Error Mapping, & Reconciliation:**
        *   Define `reconcileLiveFine(): boolean`: if `props.loading`, return `false`. If `isOwnAttemptPaid.value`, trigger `handleSuccessClose(props.fine!.paymentReference)` (`useToast()` success toast, reset sensitive fields/state, set `open.value = false`, then `submitting.value = false`) and return `true`. If `isStaleNonPayable.value`, clear all sensitive card fields (`formState`, `touched`, `submitErrorKey`) immediately and return `true` so the dedicated `stale_fine_warning` `<UAlert>` renders without firing an error toast. Otherwise return `false`.
        *   On submit: mark `submitAttempted = true`, validate all 4 fields; if valid and `props.fine` is payable, update `paymentAttemptId` if `submittedSummaryKey !== null` differs from current `{ cardholderName, cardBrand, cardLast4 }`, store current `submittedSummaryKey`, set `submitting.value = true`, clear `submitErrorKey`, and call `finesStore.payFine(...)`.
        *   On success: invoke `handleSuccessClose(res.paymentReference)` (show single localized success toast via `useToast()`, reset form/attempt state, set `open.value = false`, then `submitting.value = false` so closing precedes resetting `submitting`).
        *   On `catch (err)`: set `submitting.value = false`. Call `if (reconcileLiveFine()) return;` first; if unhandled, inspect `(err as { code?: string })?.code` (`'functions/failed-precondition'`, `'functions/permission-denied'`, `'functions/not-found'`, `'functions/invalid-argument'`, `'functions/deadline-exceeded'`, `'functions/unavailable'`) and fall back to `'owner.fines.payment_modal.errors.server_generic'`; keep entered card fields intact, set `submitErrorKey` for inline `<UAlert>`, and call `toast.add({ title: t('owner.fines.payment_modal.error_title'), description: t(submitErrorKey), color: 'error' })`.
        *   Watch `[() => props.fine, () => props.loading, submitting]`: return immediately when `!open.value || submitting.value`; otherwise run `reconcileLiveFine()`.
        *   Reset `formState`, `touched`, `submitAttempted`, `submitErrorKey`, `submittedSummaryKey`, `lastKnownFine`, and `paymentAttemptId` when `open.value` transitions to `false` and in `onBeforeUnmount`.

#### 14. `front/app/components/molecules/OwnerFineCard.vue` (Modify)
*   **Type / Scope**: Frontend Molecule Component
*   **Proposed Changes**:
    *   Add `defineEmits<{ (e: 'pay', fine: Fine): void }>()`.
    *   Change the Pay `<UButton>` from `@click="finesStore.payFine(fine.id)"` and `:loading="finesStore.acting"` to `@click="emit('pay', fine)"` (removing `:loading` from the Pay trigger button). Leave the Dispute button and existing `isDisputeOpen` inline modal intact.

#### 15. `front/app/components/organisms/OwnerFinesTab.vue` (Modify)
*   **Type / Scope**: Frontend Organism Component
*   **Proposed Changes**:
    *   Type `fines: Fine[]` in `defineProps<{ fines: Fine[]; loading: boolean }>()`.
    *   Add `isPayModalOpen = ref(false)` and `selectedPayFineId = ref<string | null>(null)`.
    *   Bind `@pay="handleOpenPayModal"` on `<MoleculesOwnerFineCard>` inside `unpaidFines` `v-for`: set `selectedPayFineId.value = fine.id` and `isPayModalOpen.value = true`.
    *   Derive `activePayFine = computed(() => props.fines.find(f => f.id === selectedPayFineId.value) ?? null)`.
    *   When `isPayModalOpen` closes (`false`), clear `selectedPayFineId.value = null` after the modal transition settles (matching existing owner modal transitions so summary content does not flicker mid-close).
    *   Mount `<OrganismsOwnerPayFineModal v-model:open="isPayModalOpen" :fine="activePayFine" :loading="props.loading" />` outside the `unpaidFines` / `paidFines` `v-for` lists.

#### 16. `front/i18n/locales/en.json`, `front/i18n/locales/fr.json`, `front/i18n/locales/ar.json` (Modify)
*   **Type / Scope**: Frontend Localization Files
*   **Proposed Changes**:
    *   Add aligned `owner.fines.payment_modal` keys across all three locales:
        *   `title`, `subtitle`, `simulated_notice`, `summary_plate`, `summary_reference`, `summary_amount`
        *   `cardholder_label`, `cardholder_placeholder`, `card_number_label`, `card_number_placeholder`, `expiry_label`, `expiry_placeholder`, `cvv_label`, `cvv_placeholder`
        *   `brands`: `{ visa, mastercard, amex, discover }`
        *   `confirm_button` (with `{amount}`), `submitting_button`, `stale_fine_warning`
        *   `success_title`, `success_desc` (with `{reference}`), `error_title`
        *   `errors`: `{ cardholder_required, cardholder_invalid, card_number_required, card_brand_unsupported, card_number_invalid, expiry_required, expiry_format, expiry_expired, cvv_required, cvv_invalid, server_failed_precondition, server_permission_denied, server_not_found, server_invalid_argument, server_timeout, server_unavailable, server_generic }`

#### 17. `front/tests/cardValidation.test.ts` (Create) & `front/tests/fineConverter.test.ts` (Modify)
*   **Type / Scope**: Frontend Unit Tests (Vitest)
*   **Proposed Changes**:
    *   Create `front/tests/cardValidation.test.ts` covering:
        *   Luhn valid/invalid cases.
        *   Exact and boundary BIN prefix detection (`2220` -> `null`, `2221`–`2720` -> `mastercard`, `2721` -> `null`, `222` -> `null`; `643` -> `null`, `644`–`649` -> `discover`, `65` -> `discover`, `64` -> `null`; `34`/`37` -> `amex`; `4` -> `visa`; unrecognized Luhn-valid BIN range -> `'owner.fines.payment_modal.errors.card_brand_unsupported'`).
        *   PAN lengths (`13`/`16`/`19` Visa, `16` Mastercard/Discover, `15` Amex) and `formatCardNumber` (`4-6-5` Amex vs `4-4-4-4` vs 19-digit cap when `brand === null`).
        *   `formatExpiry` (including `MM/YYYY` and `YYYY-MM` browser autofill normalization) and `validateExpiry` (current month passes, previous month fails, invalid month `00`/`13` fails, `+20` years passes, `+21` years returns `expiry_format`).
        *   CVV rules (4 digits for Amex, 3 digits for others) and `cardholderName` boundaries (1 char fails, 2–100 chars pass, control char fails).
    *   Update `front/tests/fineConverter.test.ts` to test `paidAt`, `paymentReference`, `paymentProvider`, and `paymentAttemptId` normalization when present, and assert `paidAt` stays `undefined` (never `Date.now()`) when missing on legacy/unpaid fines.

### Verification Plan

*   **Phase 1 Automated**: `cd functions && pnpm run build && pnpm run lint && pnpm run test:unit`
*   **Phase 2 Automated**: Run emulator tests either as a one-shot run (`firebase emulators:exec --only firestore "cd functions && pnpm run test:emulator"`) or standalone against an active Firestore emulator (`cd functions && pnpm run test:emulator`).
*   **Phase 3 Automated**: Run `cd front && pnpm install` first if local `node_modules/@nuxt/ui` lags `pnpm-lock.yaml`, then `cd front && pnpm test && pnpm run lint && pnpm exec nuxt typecheck && pnpm run build`.
*   **Manual UI & Emulator Verification** (via `./front/dev.sh` or equivalent emulator startup):
    *   **Validation & RTL/LTR**: Test `en`, `fr`, and `ar` locales; confirm `dir="ltr"` on card number, expiry, and CVV, `dir="auto"` on cardholder name, Amex 4-digit CVV vs. 3-digit CVV, expired `MM/YY`, and `card_brand_unsupported` rejection.
    *   **Submission Lock**: Throttle network to Slow 3G in browser DevTools during submission and verify Cancel, Confirm, header `X`, backdrop click, and `Escape` are disabled while unrelated fine cards (if multiple unpaid fines exist) do not spin.
    *   **Failure Preservation, Cancel Reset, & Error Mapping**: Switch DevTools to Offline to force failure; verify inline alert + localized error toast (`server_unavailable` / `server_timeout`), entered fields remain populated, then go Online and retry with preserved fields (post-failure retry succeeds; backend idempotency for committed timeouts is covered by Phase 1 unit tests). Open a second unpaid fine, enter partial values, click Cancel, and reopen that same fine to verify fields are wiped.
    *   **Stale / Live Reconciliation**: Open the modal on an unpaid fine and transition that fine (e.g., dispute or mark paid in Firestore Emulator UI) while open; verify `reconcileLiveFine()` wipes inputs immediately, shows `stale_fine_warning`, and disables Confirm.
    *   **Firestore Inspection**: Inspect Firestore Emulator UI to verify `fines/{fineId}` contains `status: 'paid'`, `paidAt`, `paymentReference`, `paymentProvider: 'simulated'`, and `paymentAttemptId` (no `cardholderName`); `fines/{fineId}/receipt/summary` contains only `{ cardholderName, cardBrand, cardLast4 }`; and `enforcement_audit_logs` contains `PAY_FINE` with `paymentReference` and `paymentProvider` (no `cardholderName`, `paymentAttemptId`, `cardBrand`, or `cardLast4`).

--------------------------------------------------------------------------------

*Drafted with EGM*