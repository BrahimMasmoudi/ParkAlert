# Feature Specification: Two-Step Ownership Transfer Hardening & Bug Fixes

**Feature Branch**: `changer-transfer-way`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Create specs for the fixes first (for the two-step ownership transfer workflow on branch changer-transfer-way: Police approves, Owner B gets the car, Owner A loses access, addressing all architectural, concurrency, security, permission, state-machine, unpaid-fine, privacy, UI, and localization defects)."

## Clarifications

### Session 2026-11-16

- Q: After a transfer is approved, what should Owner A still be able to see regarding the transferred vehicle and its history? → A: Owner A keeps their own fine history completely intact and loses all read/write access to the transferred vehicle record (no live "Previously Owned" vehicle visibility).
- Q: When Owner A rejects an incoming transfer request, should Owner A be required to provide a reason or be able to reject with one click? → A: Require Owner A to enter or select a non-empty rejection reason via a prompt/modal before submitting (same rule as Police).
- Q: Who should be allowed to reject or cancel a pending transfer at each stage of the workflow? → A: Strictly stage-scoped: only the current owner (Owner A) may reject during Awaiting Owner Acceptance, and only Police may reject during Awaiting Police Approval.

## Problem Statement

The two-step vehicle ownership transfer implementation on `changer-transfer-way` introduces critical security, concurrency, data-consistency, and user-experience defects:
- Any authenticated caller can approve or reject transfers due to missing role checks and caller-identity spoofing (`...request.data` overwriting `actorId`/`ownerId`/`receiverId`), while `RetryCarUseCase` spreads unvalidated `...updates` fields and auxiliary vehicle endpoints (`approveCar`, `rejectCar`, `requestCarDeletion`, `cancelCarDeletion`) also omit role checks.
- Owner A retains permanent read access to the transferred vehicle and Owner B's newly attached documents via `ownershipHistory` in `firestore.rules`, unguarded Police queries (`pendingCarsRef`, `allFinesQuery`) trigger `permission-denied` errors on the Owner Dashboard, and persistent `getDownloadURL()` tokens plus broad `storage.rules` expose uploaded Carte Grise files to any signed-in user or token holder.
- State changes, unpaid-fine checks, and audit logs execute without atomic Firestore transactions (`IssueFineUseCase` still uses `WriteBatch` and `hasUnpaidFines` uses unattached queries), creating race conditions between concurrent approvals, duplicate registrations, and fine issuance.
- Unpaid-fine queries compare normalized plates (`AB123CD`) against dashed plates (`AB-123-CD`) stored on `fines`, and `fireway` will not re-run `v2__plate_as_id.ts` on already-migrated environments.
- Transfers can be initiated on non-`active` vehicles, Owner A's UI rejection button crashes without a reason, `checkPlate` leaks masked owner IDs, `ar.json` is missing new status keys, and obsolete single-step transfer modal code remains wired.

## Goals & Non-Goals

### Goals
- Enforce strict session-derived caller identity, field whitelisting, role authorization, and stage-scoped transition guards across all vehicle and transfer endpoints.
- Revoke Owner A's read/write access to transferred vehicles immediately on approval while preserving Owner A's own `fines` history and eliminating `permission-denied` client listener errors.
- Eliminate `getDownloadURL()` token bypasses for new uploads and serve documents exclusively via backend-authorized short-lived signed URLs (`getDocumentUrl`).
- Guarantee atomic transactional execution (`runTransaction` + `transaction.get`) across transfer transitions, vehicle registration/retry, and concurrent fine issuance with consistent normalized plate matching and a new `v3` backfill migration.
- Fix Owner A rejection UX, plate lookup privacy/debouncing, document viewing for both paths and legacy HTTPS URLs, obsolete modal cleanup, and full `en`/`fr`/`ar` (`RTL`) localization.

### Non-Goals
- Building a separate anonymized "previously owned vehicle" archive collection for Owner A.
- Retroactively invalidating legacy `getDownloadURL()` download tokens outside the repository's scope unless rotated via migration/re-upload (documented under Risks).
- Introducing an online payment gateway for settling fines.

## Proposed Architecture

The fix spans four layers while preserving ParkAlert's Hexagonal Architecture (`functions/src/`) and Atomic Design frontend (`front/app/`):

1. **Client UI & Pinia Stores (`front/`)**:
   - Remove the live `historicalCars` Firestore query (`stores/cars.ts`) and "Previously Owned" UI (`OwnerVehiclesTab.vue`), role-gate `pendingCarsRef` (`stores/cars.ts`) and `allFinesQuery` (`stores/fines.ts`) to `role === 'police'`, and remove the obsolete `OwnerTransferCarModal` and unused `transfer` event emit on `OwnerCarCard.vue`.
   - Update `OwnerAddCarModal.vue` to debounce `checkPlate` with stale-response sequence guarding, allow `image/*` and `application/pdf` matching `storage.rules`, persist canonical Storage object paths instead of `getDownloadURL()` tokens, and use `$t(...)` i18n keys across `en`, `fr`, and `ar` (`RTL`).
   - Add a frontend document-viewer resolver (used by `OwnerCarCard.vue` and Police review views) that requests a short-lived signed URL via `getDocumentUrl` for canonical Storage paths while preserving legacy `https://` links.
   - Add an Owner A rejection reason prompt/modal in `OwnerCarCard.vue` (or dedicated modal) enforcing 3–500 trimmed characters.
2. **Cloud Functions `onCall` Entry Points (`functions/src/infrastructure/entry-points/`)**:
   - Spread `...request.data` *before* server-verified `request.auth.uid` fields (or construct explicit DTOs) so caller IDs cannot be spoofed.
   - Replace `WriteBatch` with `runTransaction` in `entry-points/fine/issue-fine.ts` and expose `getDocumentUrl` for authorized document access.
   - Map domain/application failures to semantic `HttpsError` codes (`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`, `already-exists`).
3. **Domain & Application Transactional Use Cases (`functions/src/domain/`, `functions/src/application/`)**:
   - Centralize plate normalization in a pure domain helper shared across registration, fine issuance, transfer checks, and migrations.
   - Inject `UserRepository` into `ApproveTransferUseCase`, `RejectTransferUseCase`, `RequestOwnershipTransferUseCase`, `CheckPlateAvailabilityUseCase`, and auxiliary car use cases (`ApproveCarUseCase`, `RejectCarUseCase`, `RequestCarDeletionUseCase`, `CancelCarDeletionUseCase`) for uniform role verification (`owner` vs `police`).
   - Whitelist mutable fields in `RetryCarUseCase` (`brand`, `model`, `color`, `carteGriseUrl`) and forbid changing `plateNumber` on retry so `id === plateNumberNormalized` stays invariant.
   - Execute `AddCarUseCase`, `RetryCarUseCase`, `RequestOwnershipTransferUseCase`, `AcknowledgeTransferUseCase`, `ApproveTransferUseCase`, `RejectTransferUseCase`, `RequestCarDeletionUseCase`, `CancelCarDeletionUseCase`, and `IssueFineUseCase` inside an abstract transaction unit-of-work (`runTransaction`) passed through repository ports so all reads/queries (`transaction.get`), state updates, fine checks (`hasUnpaidFines`), and `car_audit_logs` commit atomically.
   - State machine: only `active` vehicles enter `transfer_pending_owner` → `transfer_pending_police` → `active` (on Police approval) or → `active` (on stage-scoped rejection); `IssueFineUseCase` resolves the vehicle by normalized plate inside the transaction and validates `car.ownerId === request.ownerId` and `car.status !== 'archived'`.
4. **Persistence, Security Rules, & Migrations (`firestore.rules`, `storage.rules`, `functions/migrations/`)**:
   - Remove `request.auth.uid in resource.data.ownershipHistory` from `firestore.rules` `/cars/{carId}` and keep `ownershipHistory` server-side/audit-only.
   - Set `storage.rules` direct client reads on `/carteGrise/...` and `/transfers/...` to `allow read: if false;` (serving all reads via `getDocumentUrl` short-lived signed URLs after verifying current Firestore role/ownership).
   - Add composite Firestore index on `fines` (`ownerId`, `plateNumberNormalized`, `status`).
   - Harden `v2__plate_as_id.ts` for fresh deployments AND add a new idempotent `v3__backfill_fines_and_audit_logs.ts` migration so already-migrated environments backfill `fines.plateNumberNormalized` and repair/verify `car_audit_logs.carId` references safely in chunked batches (`<= 450` ops).

## Alternatives Considered

1. **Storage Document Access: Backend Short-Lived Signed URLs vs. Auth Custom Claims + `storage.rules` vs. `getDownloadURL()`**
   - *Rejected alternative A (`getDownloadURL()` + `storage.rules`)*: `getDownloadURL()` embeds persistent public download tokens that bypass `storage.rules` completely, and `storage.rules` cannot read Firestore `/users/{uid}` documents.
   - *Rejected alternative B (Auth custom claims + `storage.rules` + `getBlob()`)*: Requires adding `setCustomUserClaims` to `SetUserRoleUseCase`, hardening `setUserRole` against self-escalation, backfilling existing Police users, and forcing token refreshes on role changes.
   - *Chosen approach (Backend `getDocumentUrl` short-lived signed URLs + `allow read: if false` in `storage.rules`)*: Evaluates live Firestore `role === 'police'` or current vehicle/upload ownership immediately on every request, requires zero custom-claim backfill or token refresh, and works cleanly behind a single viewer helper.
2. **Fine-vs-Transfer Concurrency: Shared Vehicle Transaction Lock vs. Post-Transfer Fine Attribution**
   - *Rejected alternative*: Leaving `IssueFineUseCase` on `WriteBatch` (non-transactional wrt `cars`) and reconciling fines issued mid-transfer afterward.
   - *Rationale*: Once ownership switches to Owner B, a post-hoc unpaid fine on Owner A violates the invariant that no transfer completes while unpaid fines exist on the outgoing vehicle and creates legal ownership disputes. Reading `cars/{carId}` inside `IssueFineUseCase`'s transaction and executing `hasUnpaidFines` via `transaction.get(...)` serializes both operations cleanly.
3. **Post-Transfer History: Full Vehicle Access Revocation (Keep `fines`) vs. Redacted Snapshot Subcollection**
   - *Rejected alternative*: Creating a separate `car_transfer_receipts` collection for Owner A.
   - *Rationale*: Owner A already retains full access to their historical `fines` collection (`ownerId == Owner A`), and keeping scope tight avoids duplicating vehicle metadata for this security-fix milestone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Authorization & Caller Identity Enforcement (Priority: P1)

Only legitimately authenticated and authorized actors can advance or terminate an ownership transfer or mutate vehicle lifecycle states. No caller can spoof another user's identity, overwrite protected fields, or bypass role checks.

**Why this priority**: Currently, any authenticated user can approve or reject transfers, spoof another user's identifier in transfer requests, or pass protected fields (`ownerId`, `status`) into `retryCar`, representing critical privilege-escalation vulnerabilities.

**Independent Test**: Attempt each vehicle and transfer action (`addCar`, `retryCar`, `checkPlate`, `requestOwnershipTransfer`, `acknowledgeTransfer`, `approveTransfer`, `rejectTransfer`, `approveCar`, `rejectCar`, `requestCarDeletion`, `cancelCarDeletion`) as an unauthenticated user, a different owner, a traffic agent, a police officer, and with forged fields in `request.data`.

**Acceptance Scenarios**:

1. **Given** an authenticated user who is not a Police Officer (including Owner A, Owner B, or a Traffic Agent), **When** they attempt to approve a transfer awaiting police approval (or approve/reject a registration), **Then** the system rejects the request as `permission-denied` and leaves the vehicle unchanged.
2. **Given** a vehicle in `Awaiting Owner Acceptance` (or `Awaiting Police Approval`), **When** an authenticated user who is not the stage's authorized actor (anyone other than the current owner during `Awaiting Owner Acceptance`, or anyone other than a Police Officer during `Awaiting Police Approval`) attempts to reject the transfer, **Then** the system rejects the request as `permission-denied`.
3. **Given** an authenticated user (Owner B) who passes Owner A's identifier in the request payload while calling `acknowledgeTransfer` (or passes protected `ownerId`/`status` fields to `retryCar`), **When** the system processes the request, **Then** it ignores caller-supplied identity/protected fields, derives the caller solely from the verified session, and rejects unauthorized mutations as `permission-denied`.
4. **Given** a non-owner account (e.g., Traffic Agent or Police Officer) attempting to initiate an ownership transfer, check plate transfer eligibility, or request/cancel deletion as an owner, **When** they submit the request, **Then** the system rejects it as `permission-denied`.

---

### User Story 2 - Post-Transfer Access Revocation & Document Privacy (Priority: P1)

When Police approves an ownership transfer from Owner A to Owner B, Owner B becomes the sole vehicle owner with the new registration document active, and Owner A immediately loses all read and write access to the vehicle record and Owner B's documents. Uploaded registration and transfer documents are accessible only to authorized parties via short-lived signed URLs.

**Why this priority**: The core business rule states "Police approves. Owner B gets the car. Owner A loses access." Currently, `ownershipHistory` leaves Owner A with permanent read access to the vehicle and Owner B's private documents, unguarded Police listeners throw `permission-denied`, and `getDownloadURL()` + `storage.rules` expose uploaded files to any signed-in user or token holder.

**Independent Test**: Complete a full two-step transfer from Owner A to Owner B, then attempt as Owner A (and an unrelated signed-in user) to view the vehicle record, call `getDocumentUrl`, read Storage directly, and load the Owner Dashboard without listener errors.

**Acceptance Scenarios**:

1. **Given** a vehicle in `Awaiting Police Approval` state with a valid transfer recipient (Owner B) and transfer document path, **When** a Police Officer approves the transfer, **Then** Owner B becomes the sole owner, the transfer document path replaces the active vehicle registration document path, temporary transfer fields are cleared, and the vehicle returns to `Active`.
2. **Given** a completed transfer from Owner A to Owner B, **When** Owner A queries or attempts to read the vehicle record or opens the Owner Dashboard, **Then** access to the transferred vehicle is denied, Owner A's dashboard no longer subscribes to `historicalCars`, `pendingCarsRef`, or `allFinesQuery`, and zero `permission-denied` listener errors occur.
3. **Given** a transfer document or vehicle registration document uploaded by Owner B, **When** an unrelated authenticated user (or Owner A after transfer completion) attempts to read that file directly via Storage or via `getDocumentUrl`, **Then** access is denied; only the authorized current owner (or uploader while pending) and Police Officers receive a short-lived signed URL.
4. **Given** an unpaid or historical fine issued to Owner A prior to the transfer, **When** the transfer completes, **Then** Owner A retains access to their own fine records, not to the transferred vehicle record.

---

### User Story 3 - Atomic Concurrency & Unpaid-Fines Enforcement (Priority: P1)

Unpaid fines on a vehicle reliably block both transfer initiation and final police approval regardless of license plate formatting, and concurrent operations (duplicate approvals, concurrent fine issuance, or duplicate registrations) cannot produce partial updates, inconsistent state, or missed unpaid-fine checks.

**Why this priority**: Formatting mismatches between normalized plates and dashed plates currently let owners with unpaid fines initiate transfers, `fireway` skips modifying `v2` on migrated environments, and non-transactional `WriteBatch`/unattached queries allow race conditions between fine issuance and transfer approval.

**Independent Test**: Issue an unpaid fine using standard dashed plate formatting (e.g., `AB-123-CD`), run the `v3` backfill migration on legacy fines, then attempt transfer initiation and concurrent transfer approval/`IssueFineUseCase` execution; verify consistent blocking and single atomic outcome.

**Acceptance Scenarios**:

1. **Given** a vehicle registered as `AB-123-CD` with an unpaid fine recorded for the current owner (including pre-existing fines backfilled by `v3` with `plateNumberNormalized`), **When** Owner B submits a transfer request using `AB-123-CD` or `AB123CD`, **Then** the system detects the unpaid fine and blocks transfer initiation.
2. **Given** a vehicle in `Awaiting Police Approval` with no unpaid fines at the start of approval, **When** a Police Officer approves the transfer at the exact same moment another Police Officer calls `IssueFineUseCase` for that vehicle and current owner, **Then** both operations serialize on `cars/{carId}` inside `runTransaction` (with `hasUnpaidFines` using `transaction.get`) so either the fine fails because `car.ownerId !== request.ownerId` or the transfer is blocked due to the unpaid fine—never leaving an approved transfer alongside a newly created unpaid fine for the outgoing owner.
3. **Given** a vehicle in `Awaiting Police Approval`, **When** two Police Officers click Approve simultaneously, **Then** exactly one approval succeeds, ownership transfers once, exactly one approval audit record is created, and the second request fails cleanly with `failed-precondition`.
4. **Given** an atomic state update and its accompanying audit log entry, **When** either write fails, **Then** neither change is persisted.
5. **Given** two users simultaneously submitting a brand-new registration for the same normalized license plate, **When** both requests execute concurrently, **Then** at most one succeeds and the second is rejected with `already-exists` without overwriting the first registration.

---

### User Story 4 - Transfer State Machine Integrity & Eligibility Guards (Priority: P2)

Only eligible `Active` vehicles can enter the transfer workflow, state transitions strictly follow valid paths, and terminal or non-pending states cannot be re-approved, re-rejected, or promoted to `Active` through transfer actions.

**Why this priority**: Currently, transfers can be initiated on `Activation Pending`, `Rejected`, `Deletion Requested`, or `Archived` vehicles, rejecting such a transfer erroneously promotes the vehicle to `Active`, and `CancelCarDeletionUseCase` forces status back to `activation_pending`.

**Independent Test**: Attempt to initiate, acknowledge, approve, reject, retry, and request/cancel deletion across every vehicle status and verify every invalid transition is rejected and valid transitions restore exact expected states.

**Acceptance Scenarios**:

1. **Given** a vehicle whose status is `Activation Pending`, `Rejected`, `Deletion Requested`, or `Archived`, **When** any user attempts to initiate an ownership transfer for its plate, **Then** the system rejects the request with `failed-precondition` and leaves the vehicle status unchanged.
2. **Given** a vehicle in `Awaiting Owner Acceptance`, **When** a Police Officer attempts to approve the transfer before the current owner acknowledges it, **Then** the system rejects the request with `failed-precondition`.
3. **Given** a transfer that was already approved or rejected (vehicle is back in `Active`), **When** an approve or reject action is re-sent, **Then** the system rejects the request with `failed-precondition` without modifying ownership, history, or audit logs.
4. **Given** a vehicle in `Awaiting Police Approval` whose pending transfer recipient or transfer document is missing or invalid, **When** approval is attempted, **Then** the system rejects the approval and refuses to reset the vehicle to `Active` without completing the ownership change.
5. **Given** a vehicle in `Activation Pending`, `Deletion Requested`, `Archived`, `Awaiting Owner Acceptance`, or `Awaiting Police Approval`, **When** the current owner attempts to request vehicle deletion, **Then** deletion is rejected (`failed-precondition`); deletion requests are allowed only from `Active` or `Rejected` states, and canceling deletion restores the vehicle's prior status rather than forcing `Activation Pending`.

---

### User Story 5 - Owner Rejection UX, Plate Privacy, & Multilingual Completeness (Priority: P2)

Prospective buyers and current owners experience a working, localized, privacy-preserving interface across English, French, and Arabic (RTL), with broken/obsolete modals removed and Owner A's transfer rejection working end-to-end.

**Why this priority**: Currently, Owner A clicking "Reject Request" always fails because no rejection reason is passed, plate lookup leaks masked owner IDs on every unthrottled keystroke, Arabic translations are missing new transfer statuses, hardcoded English strings appear in the modal, and an obsolete transfer modal remains wired into the owner page.

**Independent Test**: Walk through the UI in English, French, and Arabic (RTL): check a plate, request a transfer, view documents via `getDocumentUrl`, reject a transfer as Owner A, approve/reject as Police, and verify zero failed calls, zero leaked IDs, and zero untranslated keys.

**Acceptance Scenarios**:

1. **Given** Owner A viewing an incoming transfer request in `Awaiting Owner Acceptance`, **When** Owner A clicks Reject Request, **Then** the interface prompts Owner A to enter or select a non-empty rejection reason (3–500 trimmed characters) before submitting, and upon submission the rejection succeeds and returns the vehicle to `Active`.
2. **Given** an authenticated `Owner` typing a plate number into the Add Vehicle modal, **When** the plate already exists in the system, **Then** the availability check returns only caller-relative eligibility (`available`, `eligibleForTransfer`, `reason`) without exposing any owner identifier or raw vehicle status, and only enters transfer mode when `eligibleForTransfer` is `true` (an `Active` vehicle owned by a different user).
3. **Given** the Add Vehicle modal during typing, **When** a user types or clears a plate rapidly, **Then** plate availability checks are debounced with stale-response cancellation/sequence guarding so out-of-order responses cannot flip modal state, both image and PDF files are selectable, and modal state resets cleanly when switching between adding, retrying, and requesting a transfer.
4. **Given** the Owner Dashboard and Police Control Panel rendered in English, French, and Arabic (`RTL`), **When** viewing all transfer statuses, prompts, labels, documents (both new Storage paths and legacy HTTPS URLs), and toast notifications, **Then** all text uses localized strings (including `transfer_pending_owner` and `transfer_pending_police` in Arabic, and aligned `archived` vs `deleted` status mapping) and obsolete single-step transfer modal/emit code is removed.

### Edge Cases

- What happens if Owner A enters their own vehicle's plate in the Add Vehicle modal? `checkPlate` returns `{ available: false, eligibleForTransfer: false, reason: 'OWNED_BY_CALLER' }`, informing Owner A without exposing any owner ID and without entering transfer mode.
- What happens if Owner B enters a plate belonging to a `Rejected`, `Activation Pending`, `Deletion Requested`, `Archived`, or already-pending-transfer vehicle? `checkPlate` returns `eligibleForTransfer: false` with `INELIGIBLE_STATUS` or `TRANSFER_IN_PROGRESS` (no raw status or owner info leaked) and blocks transfer submission.
- What happens if Owner B submits a transfer request with an empty, malformed, path-traversal (`..`), or third-party Storage reference? Backend validation rejects it (`invalid-argument`) unless it resolves cleanly to `transfers/<callerUid>/...`.
- What happens if a `RetryCarUseCase` request includes extra fields (`ownerId`, `status`) or changes `plateNumber`? Extra fields are ignored/rejected and `plateNumber` changes on retry are disallowed so `id === plateNumberNormalized` stays intact.
- What happens to prior vehicle and fine data during migration across fresh and existing environments? `v2__plate_as_id.ts` (for fresh runs) and a new idempotent `v3__backfill_fines_and_audit_logs.ts` migration (for existing environments) migrate atomically per vehicle, refuse to overwrite/merge *any* colliding normalized plate (cross-owner or same-owner non-identical records) by logging a conflict record for manual resolution, chunk `car_audit_logs.carId` updates in batches of `<= 450` ops, and backfill `fines.plateNumberNormalized`.
- What happens if a user switches the modal from "retry rejected car" to "add new car"? Transfer mode flags, error messages, pending `checkPlate` sequence tokens, and selected files reset completely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST derive the acting user identity exclusively from `request.auth.uid` across all vehicle and transfer endpoints, placing `...request.data` before server-assigned identity fields (or using explicit DTOs) and explicitly whitelisting mutable fields (specifically removing `...updates` in `RetryCarUseCase` and forbidding `plateNumber` changes on retry) so caller-supplied parameters can never override identity or protected fields.
- **FR-002**: System MUST verify user roles and stage authority before executing operations: only `Owner` accounts may call `checkPlate`, `addCar`, `retryCar`, `requestCarDeletion`, `cancelCarDeletion`, or `requestOwnershipTransfer`; only the vehicle's current `ownerId` may acknowledge or reject a transfer during `transfer_pending_owner`; and only `Police` officers may approve or reject a transfer during `transfer_pending_police`, as well as call `approveCar` or `rejectCar`.
- **FR-003**: System MUST immediately revoke Owner A's read and write access to the transferred vehicle record upon transfer approval by removing `ownershipHistory` read access from `firestore.rules`, removing the client-side `historicalCars` query and "Previously Owned" UI section, role-gating `pendingCarsRef` (`stores/cars.ts`) and `allFinesQuery` (`stores/fines.ts`) to `police` only, and keeping any ownership history server-only / in `car_audit_logs`, while Owner A retains full access to their own historical `fines` records.
- **FR-004**: System MUST eliminate persistent public `getDownloadURL()` tokens for new vehicle registration and transfer uploads by storing canonical Storage object paths (`carteGrise/<uid>/...`, `transfers/<uid>/...`), setting `storage.rules` direct read rules on those prefixes to `false`, and serving documents exclusively through a backend callable (`getDocumentUrl`) that verifies live Firestore authorization (`role === 'police'`, current vehicle `ownerId`, or pending transfer uploader while pending) and returns a short-lived signed URL.
- **FR-005**: System MUST allow initiating a transfer ONLY when the target vehicle's current status is `active` and the requester is not already the current owner.
- **FR-006**: System MUST normalize license plate identifiers identically via a shared domain helper across vehicle registration, fine issuance (storing `plateNumberNormalized` alongside display `plateNumber` on `Fine`), client unpaid-fine badge matching (`OwnerCarCard.vue`), and unpaid-fine checks so unpaid fines reliably block both transfer initiation and approval regardless of plate formatting.
- **FR-007**: System MUST execute all state-changing transfer operations (`initiate`, `acknowledge`, `approve`, `reject`), `addCar`, `retryCar`, `approveCar`, `rejectCar`, `requestCarDeletion`, `cancelCarDeletion`, `approveCarDeletion`, and `IssueFineUseCase` (replacing `WriteBatch` in `entry-points/fine/issue-fine.ts` with `runTransaction`) inside atomic Firestore transactions where all reads/queries (specifically `hasUnpaidFines` and `getById`/`getByPlateNumber`) use `transaction.get(...)`, audit logs commit atomically in the same transaction, and `IssueFineUseCase` validates inside the transaction that the target vehicle exists, `car.ownerId === request.ownerId`, and `car.status !== 'archived'`.
- **FR-008**: System MUST reject any transfer approval (`failed-precondition`) if `transferToOwnerId` or `transferCarteGriseUrl` is missing, and MUST prevent completed or rejected transfers from being re-approved or re-rejected.
- **FR-009**: System MUST allow vehicle deletion requests (`requestCarDeletion`) ONLY when the vehicle status is `active` or `rejected`, rejecting deletion requests in `activation_pending`, `deletion_requested`, `archived`, `transfer_pending_owner`, or `transfer_pending_police`, and MUST restore the vehicle's pre-deletion status (`active` or `rejected`) in `cancelCarDeletion` rather than unconditionally resetting to `activation_pending`.
- **FR-010**: System MUST restrict `checkPlate` to return only `{ available, eligibleForTransfer, reason?: 'OWNED_BY_CALLER' | 'INELIGIBLE_STATUS' | 'TRANSFER_IN_PROGRESS' }` without exposing any `ownerId` (masked or otherwise) or raw vehicle status, and MUST only enter transfer initiation mode in the UI when `eligibleForTransfer` is `true`.
- **FR-011**: System MUST prompt Owner A via a modal/prompt to provide a trimmed rejection reason of 3–500 characters matching server validation; debounce `checkPlate` calls with stale-response sequence/cancellation guards; reset modal state on mode transitions; support both images and PDFs matching `storage.rules`; provide a document-viewer resolver handling both canonical Storage paths (via `getDocumentUrl`) and legacy `https://` URLs; align `'archived'` vs `'deleted'` status naming and remove the obsolete `OwnerTransferCarModal` and `'transfer'` emit; and provide complete translations across `en`, `fr`, and `ar` (`RTL`) with zero hardcoded UI strings.
- **FR-012**: System MUST validate uploaded document references server-side against canonical Storage object paths under `transfers/<callerUid>/...` (for transfers) or `carteGrise/<callerUid>/...` (for `addCar` and `retryCar`), rejecting empty values, external URLs, or `..` path-traversal segments, and enforce trimmed rejection reasons (3–500 characters).
- **FR-013**: Data migrations MUST harden `v2__plate_as_id.ts` for fresh deployments AND introduce a new idempotent `v3__backfill_fines_and_audit_logs.ts` migration for already-migrated environments, executing atomically per vehicle, refusing to overwrite or merge *any* colliding normalized plate (cross-owner or same-owner non-identical records) by logging a conflict record for manual resolution, chunking `car_audit_logs.carId` updates in batches of `<= 450` operations, and backfilling `plateNumberNormalized` on existing `fines`.
- **FR-014**: All vehicle and transfer Cloud Functions entry points MUST map errors to semantic `HttpsError` codes (`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`, `already-exists`) rather than wrapping all failures as `internal`.

### Key Entities

- **Vehicle**: Registered vehicle keyed by normalized license plate (`id === plateNumberNormalized`), with `ownerId`, display `plateNumber`, `plateNumberNormalized`, lifecycle `status` (`activation_pending`, `active`, `rejected`, `deletion_requested`, `archived`, `transfer_pending_owner`, `transfer_pending_police`), optional `preDeletionStatus`, active registration document path (or legacy HTTPS URL), and pending-transfer attributes (`transferToOwnerId`, `transferCarteGriseUrl`, `transferRequestedAt`, `transferRejectionReason`).
- **Transfer Request State**: Transitional lifecycle on the Vehicle (`transfer_pending_owner` → `transfer_pending_police` → `active` with new owner, or → `active` on stage-scoped rejection), executed atomically with audit logs.
- **Fine**: Parking violation penalty tied to `ownerId`, display `plateNumber`, and `plateNumberNormalized`, with status (`unpaid`, `paid`) that blocks outgoing ownership transfers while `unpaid`.
- **Vehicle Audit Log**: Immutable `car_audit_logs` entry recording every vehicle and transfer lifecycle transition, `actorId`, `action`, timestamp, and rejection reason when applicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of unauthorized vehicle/transfer calls (wrong role, non-owner acknowledgment, wrong-stage rejection, non-police approval, protected-field injection, or payload identity spoofing) fail with `permission-denied` / `unauthenticated` / `invalid-argument` and zero state mutations.
- **SC-002**: Within 1 second of police transfer approval, Owner A has zero Firestore read/write access to the transferred vehicle record and zero Storage or `getDocumentUrl` access to Owner B's newly uploaded documents, while Owner B immediately sees the vehicle as `Active` under their account and Owner A retains access to their own `fines`.
- **SC-003**: 100% of transfer attempts involving an unpaid fine—including pre-existing fines backfilled by `v3` and plates entered with or without dashes—are blocked at both initiation and police approval.
- **SC-004**: Under simulated concurrent execution (simultaneous duplicate approvals, concurrent approval + `IssueFineUseCase`, or concurrent duplicate vehicle registrations), 0% of runs produce partial updates, duplicate audit entries, overwritten registrations, or an approved transfer coexisting with an unpaid fine on the outgoing owner.
- **SC-005**: 100% of transfer UI flows (debounced `checkPlate`, initiate transfer, document viewing via `getDocumentUrl` and legacy URLs, Owner A acknowledge, Owner A reject with reason, Police approve, Police reject) succeed end-to-end across English, French, and Arabic (`RTL`) with zero untranslated keys, zero `permission-denied` listener errors, and zero broken button actions.

## Risks, Constraints & Mitigations

- **Legacy `getDownloadURL()` tokens on pre-existing vehicles**: Existing `cars` records already storing `getDownloadURL()` tokenized URLs cannot be retroactively protected by `storage.rules` alone unless their Firebase Storage download tokens are revoked or migrated. *Mitigation*: New uploads use canonical object paths + `getDocumentUrl` signed URLs, and the UI viewer resolver supports both paths and legacy URLs while optionally allowing a follow-up token-revocation migration.
- **Firestore transaction contention & index requirements**: Serializing `IssueFineUseCase` and `ApproveTransferUseCase` on `cars/{carId}` introduces optimistic concurrency retries if both target the same plate simultaneously, and transactional `hasUnpaidFines` requires a composite index on `fines` (`ownerId`, `plateNumberNormalized`, `status`). *Mitigation*: Contention is scoped to single vehicles (minimal blast radius) and `firestore.indexes.json` must be deployed prior to Cloud Functions.
- **Deployment ordering**: Deploying tighter `firestore.rules` (removing `ownershipHistory`) before deploying the frontend removal of `historicalCars` causes immediate `permission-denied` listener errors for owners. *Mitigation*: Deploy composite indexes + backend functions + `v3` migration + frontend store update before tightening `firestore.rules` and `storage.rules`.
- **Signed URL expiry & orphaned pre-validation uploads**: Short-lived signed URLs expire after their TTL if a browser tab stays open for hours, and failed `requestOwnershipTransfer` or `addCar` calls after file upload can leave unreferenced objects in Storage. *Mitigation*: Generate signed URLs on click/demand (short TTL, e.g., 5 minutes) and trigger best-effort client cleanup on submission failure alongside optional Storage lifecycle rules on unreferenced temporary prefixes.

## Assumptions

- **Automated verification**: Existing backend and frontend packages currently rely on `tsc` and `eslint` checks without a configured test runner; adding automated unit/emulator tests covering security rules, transactions, and use cases will be part of the implementation plan for these fixes.
