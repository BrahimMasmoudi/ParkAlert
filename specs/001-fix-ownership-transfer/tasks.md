---

description: "Actionable, dependency-ordered task list for Two-Step Ownership Transfer Hardening & Bug Fixes"
---

# Tasks: Two-Step Ownership Transfer Hardening & Bug Fixes

**Input**: Design documents from `/specs/001-fix-ownership-transfer/`
**Prerequisites**: [plan.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/plan.md), [spec.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/spec.md), [research.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/research.md), [data-model.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/data-model.md), [cloud-functions.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/contracts/cloud-functions.md), [security-rules.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/contracts/security-rules.md)

**Tests**: Automated `vitest` unit, security-rules, and Firebase Emulator concurrency tests are explicitly included per [plan.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/plan.md) and [quickstart.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/quickstart.md).

**Organization**: Tasks are grouped by user story (`US1`–`US5` in priority order `P1` → `P2`) to enable independent implementation and verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps task to its user story (`US1`–`US5`); omitted in Setup, Foundational, and Polish phases

---

## Phase 1: Setup (Test & Tooling Infrastructure)

**Purpose**: Configure automated test runners for both packages without altering existing lint/build pipelines.

- [X] T001 [P] Add `vitest`, `@firebase/rules-unit-testing`, and `test:unit` / `test:emulator` scripts in `functions/package.json` and `functions/vitest.config.ts`
- [X] T002 [P] Add `vitest` and `test` script in `front/package.json` and `front/vitest.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish pure domain primitives, transaction ports, error mapping, repository transaction support, entity updates, and composite indexes required by all user stories.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 [P] Create pure `DomainError` class and codes (`PERMISSION_DENIED`, `INVALID_ARGUMENT`, `NOT_FOUND`, `FAILED_PRECONDITION`, `ALREADY_EXISTS`) in `functions/src/domain/errors/domain.error.ts`
- [X] T004 [P] Create shared `normalizePlate(plate)` (`String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '')`) and Storage path validators (`isValidRegistrationPath` matching `^carteGrise/<uid>/[^/]+$` and `isValidTransferPath` matching `^transfers/<uid>/[^/]+$`, rejecting `..`) in `functions/src/domain/value-objects/plate.ts`
- [X] T005 [P] Create opaque `TransactionContext` and `TransactionRunner` port in `functions/src/domain/repositories/transaction.port.ts`
- [X] T006 [P] Create `DocumentStoragePort` (`getSignedReadUrl(path, ttlSeconds)`) in `functions/src/domain/repositories/storage.port.ts`
- [X] T007 [P] Add `preDeletionStatus?: 'active' | 'rejected' | null` to `Car` in `functions/src/domain/entities/car.entity.ts` and `plateNumberNormalized: string` to `Fine` in `functions/src/domain/entities/fine.entity.ts`
- [X] T008 Update repository interfaces (`car.repository.ts`, `fine.repository.ts`, `report.repository.ts`, `user.repository.ts`) under `functions/src/domain/repositories/` to accept optional `tx?: TransactionContext` on reads, writes, `hasUnpaidFines(ownerId, normalizedPlate, tx?)`, and `addAuditLog`
- [X] T009 Implement `FirestoreTransactionRunner` in `functions/src/infrastructure/adapters/persistence/FirestoreTransactionRunner.ts` wrapping `FirestoreConnector.runTransaction` and export `transactionRunner` in `functions/src/infrastructure/entry-points/index.ts`
- [X] T010 Implement `mapDomainErrorToHttpsError` translating `DomainError` codes to semantic Firebase `HttpsError` codes (`permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`, `already-exists`) in `functions/src/infrastructure/entry-points/shared/error-mapper.ts`
- [X] T011 Update `FirestoreCarRepository.ts` (`tx.get`, `tx.create` for `create`, `tx.update`, `tx.create` for `addAuditLog`), `FirestoreFineRepository.ts` (`tx.get` on `plateNumberNormalized` query in `hasUnpaidFines`, `tx.set` on `create`), `FirestoreReportRepository.ts`, and `FirestoreUserRepository.ts` in `functions/src/infrastructure/adapters/persistence/` to honor `tx?: TransactionContext`
- [X] T012 [P] Add `fines` composite index (`ownerId` ASC, `plateNumberNormalized` ASC, `status` ASC) in `firestore.indexes.json`

**Checkpoint**: Foundation ready — pure domain abstractions, transaction runner, error mapper, and composite index definition are complete.

---

## Phase 3: User Story 1 - Secure Authorization & Caller Identity Enforcement (Priority: P1) 🎯 MVP

**Goal**: Eliminate caller UID spoofing, unvalidated `...updates` field injection, and missing role/stage checks across all vehicle and transfer endpoints.

**Independent Test**: Run backend unit tests simulating unauthenticated callers, wrong roles (`owner`/`agent`/`police`), wrong owners, and forged `actorId`/`ownerId`/`receiverId`/protected fields in `request.data`, verifying `permission-denied` / `invalid-argument` and zero state mutations.

### Tests for User Story 1

- [X] T013 [P] [US1] Write unit tests for caller identity isolation, role enforcement, stage-scoped rejection authority, and `retryCar` field whitelisting across all car/transfer use cases in `functions/tests/unit/car-authorization.spec.ts`
- [X] T014 [P] [US1] Write entry-point tests verifying `...request.data` cannot spoof `actorId`/`ownerId`/`receiverId`/`userId` and `DomainError` maps to semantic `HttpsError` codes in `functions/tests/unit/entry-points-auth.spec.ts`

### Implementation for User Story 1

- [X] T015 [P] [US1] Fix spread order (`...request.data` before server `request.auth.uid` or explicit DTOs) and replace `HttpsError('internal', ...)` with `mapDomainErrorToHttpsError` across `functions/src/infrastructure/entry-points/car/*.ts` (`add-car.ts`, `retry-car.ts`, `check-plate.ts`, `request-ownership-transfer.ts`, `acknowledge-transfer.ts`, `approve-transfer.ts`, `reject-transfer.ts`, `approve-car.ts`, `reject-car.ts`, `request-car-deletion.ts`, `cancel-car-deletion.ts`, `approve-car-deletion.ts`)
- [X] T016 [P] [US1] Inject `UserRepository` and enforce `role === 'police'` in `functions/src/application/usecases/car/approve-transfer.ts`, `approve-car.ts`, and `reject-car.ts` (and require trimmed `reason` length `3..500` on `reject-car.ts`)
- [X] T017 [P] [US1] Inject `UserRepository` and enforce stage-scoped rejection authority (`owner` with `car.ownerId === actorId` when `transfer_pending_owner`; `police` when `transfer_pending_police`) and trimmed `reason` length `3..500` in `functions/src/application/usecases/car/reject-transfer.ts`
- [X] T018 [P] [US1] Inject `UserRepository` and enforce `role === 'owner'` in `functions/src/application/usecases/car/request-ownership-transfer.ts`, `acknowledge-transfer.ts`, `check-plate.ts`, `request-car-deletion.ts`, and `cancel-car-deletion.ts`
- [X] T019 [US1] Remove `...updates` spread in `functions/src/application/usecases/car/retry-car.ts`: whitelist mutable fields (`brand`, `model`, `color`, `carteGriseUrl`), forbid changing `plateNumber` on retry (`INVALID_ARGUMENT` if provided and normalized plate differs from `car.plateNumberNormalized`), and validate `carteGrise/<callerUid>/...` path via `isValidRegistrationPath`
- [X] T020 [US1] Enforce `isValidRegistrationPath` in `functions/src/application/usecases/car/add-car.ts` and `isValidTransferPath` in `functions/src/application/usecases/car/request-ownership-transfer.ts` (rejecting empty values, external URLs, or `..` segments as `INVALID_ARGUMENT`)

**Checkpoint**: User Story 1 passes unit and entry-point authorization tests independently (`SC-001`).

---

## Phase 4: User Story 2 - Post-Transfer Access Revocation & Document Privacy (Priority: P1)

**Goal**: Immediately revoke Owner A's access to transferred vehicles and Owner B's documents on approval, eliminate `getDownloadURL()` token bypasses via `getDocumentUrl` signed URLs, and stop `permission-denied` client listener errors.

**Independent Test**: Run Firestore/Storage rules unit tests and end-to-end emulator checks confirming Owner A cannot read `cars/{carId}` or `getDocumentUrl` after transfer approval, unrelated users cannot read Storage or `getDocumentUrl`, Owner A retains `fines` access, and Owner Dashboard mounts with zero `permission-denied` listener errors.

### Tests for User Story 2

- [X] T021 [P] [US2] Write `@firebase/rules-unit-testing` suite for `firestore.rules` (verifying `ownershipHistory` cannot read `/cars/{carId}`, Owner B can read, Owner A keeps `/fines` read) and `storage.rules` (`allow read: if false` on `/carteGrise` and `/transfers`) in `functions/tests/emulator/security-rules.spec.ts`
- [X] T022 [P] [US2] Write unit tests for `GetDocumentUrlUseCase` (Police allowed, current `ownerId` allowed for `'active'`, pending owner/requester allowed for `'pendingTransfer'`, former Owner A denied) in `functions/tests/unit/get-document-url.spec.ts`
- [X] T023 [P] [US2] Write frontend Pinia store tests verifying `pendingCarsRef` (`cars.ts`) and `allFinesQuery` (`fines.ts`) stay `null` for non-`police` users and `historicalCars` is removed in `front/tests/stores-gating.spec.ts`

### Implementation for User Story 2

- [X] T024 [P] [US2] Implement `StorageSignedUrlAdapter` (5-minute `getSignedUrl` in prod + `STORAGE_EMULATOR_HOST` compatible URL/read fallback in emulator) in `functions/src/infrastructure/adapters/storage/StorageSignedUrlAdapter.ts`
- [X] T025 [US2] Implement `GetDocumentUrlUseCase` in `functions/src/application/usecases/car/get-document-url.ts`, entry point using `mapDomainErrorToHttpsError` in `functions/src/infrastructure/entry-points/car/get-document-url.ts`, and export in `functions/src/infrastructure/entry-points/index.ts`
- [X] T026 [P] [US2] Remove `request.auth.uid in resource.data.ownershipHistory` from `/cars/{carId}` in `firestore.rules`
- [X] T027 [P] [US2] Set `allow read: if false;` on `/carteGrise/{ownerId}/{fileName}` and `/transfers/{userId}/{fileName}` in `storage.rules`
- [X] T028 [US2] Remove `historicalCarsRef` / `historicalCars` / `historicalCarsLoading`, role-gate `pendingCarsRef` on `authStore.userRole === 'police'`, and add `getDocumentUrl(carId, documentKind)` action in `front/app/stores/cars.ts`
- [X] T029 [P] [US2] Role-gate `allFinesQuery` on `authStore.userRole === 'police'` in `front/app/stores/fines.ts`
- [X] T030 [P] [US2] Remove the "Previously Owned" `historicalCars` section from `front/app/components/organisms/OwnerVehiclesTab.vue`
- [X] T031 [P] [US2] Create `useDocumentViewer` composable resolving canonical Storage paths via `carsStore.getDocumentUrl` while passing legacy `https://` URLs through in `front/app/composables/useDocumentViewer.ts`
- [X] T032 [US2] Replace `getDownloadURL()` with canonical Storage object paths (`carteGrise/<uid>/...` and `transfers/<uid>/...`) in `front/app/components/organisms/OwnerAddCarModal.vue`
- [X] T033 [P] [US2] Replace `<UButton :to="...">` document links with async `@click` handlers (calling `useDocumentViewer(carId, documentKind, fallbackUrl)` with `'active'` vs `'pendingTransfer'` and loading indicator) in `front/app/components/molecules/OwnerCarCard.vue`, `front/app/components/organisms/PoliceCarsTab.vue`, and `front/app/components/organisms/PoliceCarReviewModal.vue`

**Checkpoint**: User Story 2 passes rules, signed-URL, and role-gated listener tests (`SC-002`, `SC-005`).

---

## Phase 5: User Story 3 - Atomic Concurrency & Unpaid-Fines Enforcement (Priority: P1)

**Goal**: Eliminate race conditions across concurrent approvals, registrations, and fine issuance via `runTransaction` + `transaction.get`, enforce normalized plate matching for unpaid fines everywhere, and provide safe `v2` + `v3` migrations.

**Independent Test**: Run Firebase Emulator concurrency tests racing `approveTransfer` vs `approveTransfer`, `approveTransfer` vs `issueFine`, and `addCar` vs `addCar`, plus `v2`/`v3` migration tests with dashed fines and colliding plates.

### Tests for User Story 3

- [X] T034 [P] [US3] Write Firebase Emulator concurrency tests (`Promise.all` for simultaneous `approveTransfer`, `approveTransfer` vs `issueFine`, simultaneous `addCar`, and dashed vs normalized `hasUnpaidFines`) in `functions/tests/emulator/transfer-concurrency.spec.ts`
- [X] T035 [P] [US3] Write unit/emulator tests for hardened `v2__plate_as_id` and `v3__backfill_fines_and_audit_logs` (cross-owner & same-owner collisions logged to `migration_conflicts`, `car_audit_logs` `<= 450`-op batching, `fines.plateNumberNormalized` backfill) in `functions/tests/emulator/migrations.spec.ts`

### Implementation for User Story 3

- [X] T036 [US3] Wrap `add-car.ts` (`tx.create` via `carRepository.create(..., tx)`), `request-ownership-transfer.ts` (`hasUnpaidFines` using `car.plateNumberNormalized` inside `tx` + atomic `addAuditLog`), `acknowledge-transfer.ts`, `approve-transfer.ts` (`hasUnpaidFines` using `car.plateNumberNormalized` inside `tx` + atomic `addAuditLog`), `reject-transfer.ts`, `retry-car.ts`, `approve-car.ts`, `reject-car.ts`, and `approve-car-deletion.ts` inside `transactionRunner.run(...)` with all reads preceding writes in `functions/src/application/usecases/car/`
- [X] T037 [US3] Update `IssueFineUseCase` in `functions/src/application/usecases/fine/issue-fine.ts` and `functions/src/infrastructure/entry-points/fine/issue-fine.ts` to fix `...request.data` spread order (`issuedBy: request.auth.uid` cannot be overridden), use `mapDomainErrorToHttpsError`, replace `connector.getBatch()` with `transactionRunner.run(...)`, read `cars/{normalizePlate(plateNumber)}` inside the transaction, validate `car` exists with `car.ownerId === request.ownerId` and `car.status !== 'archived'`, and store `plateNumberNormalized` on the created `Fine`
- [X] T038 [P] [US3] Update unpaid-fines badge matching in `front/app/components/molecules/OwnerCarCard.vue` to compare normalized plates via `useVehicleValidation`
- [X] T039 [P] [US3] Harden `functions/migrations/v2__plate_as_id.ts` to migrate atomically per vehicle without merging/overwriting *any* colliding normalized plate (recording conflicts in `migration_conflicts`) and chunk `car_audit_logs.carId` updates in batches `<= 450`
- [X] T040 [US3] Create idempotent `functions/migrations/v3__backfill_fines_and_audit_logs.ts` to backfill `fines.plateNumberNormalized`, repair any remaining un-migrated `cars` / orphaned `car_audit_logs.carId` references in `<= 450`-op chunks, and record collisions in `migration_conflicts`

**Checkpoint**: User Story 3 passes concurrency, unpaid-fine normalization, and migration tests (`SC-003`, `SC-004`).

---

## Phase 6: User Story 4 - Transfer State Machine Integrity & Eligibility Guards (Priority: P2)

**Goal**: Restrict transfer initiation strictly to `active` vehicles, guard approval against missing transfer data or replay, restrict deletion requests to `active`/`rejected`, and restore `preDeletionStatus` on cancel.

**Independent Test**: Run unit tests sweeping every `CarStatus` (`activation_pending`, `active`, `rejected`, `deletion_requested`, `archived`, `transfer_pending_owner`, `transfer_pending_police`) across all lifecycle use cases and verify valid/rejected transitions.

### Tests for User Story 4

- [X] T041 [P] [US4] Write full state-machine matrix unit tests covering `requestOwnershipTransfer`, `acknowledgeTransfer`, `approveTransfer`, `rejectTransfer`, `requestCarDeletion`, and `cancelCarDeletion` across all 7 `CarStatus` values in `functions/tests/unit/car-state-machine.spec.ts`

### Implementation for User Story 4

- [X] T042 [US4] Enforce `car.status === 'active'` guard in `functions/src/application/usecases/car/request-ownership-transfer.ts` and require non-empty `car.transferToOwnerId` (`!== car.ownerId`) and `car.transferCarteGriseUrl` (`FAILED_PRECONDITION`) in `functions/src/application/usecases/car/approve-transfer.ts`
- [X] T043 [US4] Wrap `RequestCarDeletionUseCase` and `CancelCarDeletionUseCase` in `transactionRunner.run(...)`: restrict `request-car-deletion.ts` to `['active', 'rejected']` capturing `preDeletionStatus: car.status`, and restore `car.preDeletionStatus ?? 'active'` while clearing `preDeletionStatus` and `deletionRequestedAt` in `cancel-car-deletion.ts`
- [X] T044 [P] [US4] Align frontend `CarStatus` and `carStatusMapper` from `'deleted'` to `'archived'` in `front/app/stores/cars.ts` and `front/app/components/molecules/OwnerCarCard.vue`

**Checkpoint**: User Story 4 passes full state-machine matrix tests.

---

## Phase 7: User Story 5 - Owner Rejection UX, Plate Privacy, & Multilingual Completeness (Priority: P2)

**Goal**: Deliver privacy-safe caller-relative `checkPlate`, debounced UI lookup with stale-response guards, working Owner A rejection reason modal (`3..500` chars), PDF+image upload support, obsolete modal cleanup, and full `en`/`fr`/`ar` (`RTL`) localization.

**Independent Test**: Run frontend unit tests for `checkPlate` debounce/sequence guard and locale parity, and walk through all Owner & Police transfer flows in `en`, `fr`, and `ar` (`RTL`).

### Tests for User Story 5

- [X] T045 [P] [US5] Write unit tests for `CheckPlateAvailabilityUseCase` verifying caller-relative `{ available, eligibleForTransfer, reason }` responses with zero `ownerId`/raw `status` leakage in `functions/tests/unit/check-plate.spec.ts`
- [X] T046 [P] [US5] Write frontend tests for `OwnerAddCarModal` `checkPlate` debounce + stale-response sequence guard and key-parity verification across `front/i18n/locales/{en,fr,ar}.json` in `front/tests/transfer-ui-i18n.spec.ts`

### Implementation for User Story 5

- [X] T047 [US5] Update `functions/src/application/usecases/car/check-plate.ts` to accept `{ plateNumber, callerId }`, verify `owner` role, and return `{ available, eligibleForTransfer, reason?: 'OWNED_BY_CALLER' | 'INELIGIBLE_STATUS' | 'TRANSFER_IN_PROGRESS' }` without `ownerIdMasked` or raw `status`
- [X] T048 [P] [US5] Extract/share `normalizePlate` in `front/app/composables/useVehicleValidation.ts` and update `carsStore.checkPlate` response type in `front/app/stores/cars.ts`
- [X] T049 [US5] Update `front/app/components/organisms/OwnerAddCarModal.vue`: disable plate input when `props.carToEdit` is set (`:disabled="isTransferMode || Boolean(props.carToEdit)"`), debounce `checkPlate` (`300ms`) with monotonic request sequence guard, enter transfer mode only when `eligibleForTransfer === true`, show localized errors for `OWNED_BY_CALLER` / `INELIGIBLE_STATUS` / `TRANSFER_IN_PROGRESS`, allow `accept="image/*,application/pdf"`, reset all flags/files/sequence tokens on modal open/`carToEdit` change, and trigger best-effort Storage object deletion in both `submitAddCar` and `submitTransferRequest` if callable submission fails post-upload
- [X] T050 [US5] Add Owner A transfer-rejection reason prompt/modal (enforcing trimmed `3..500` chars) wired to `carsStore.rejectTransfer(car.id, reason)` and remove unused `(e: 'transfer', id: string)` emit in `front/app/components/molecules/OwnerCarCard.vue`
- [X] T051 [P] [US5] Remove obsolete `front/app/components/organisms/OwnerTransferCarModal.vue`, remove its mount and `handleCarTransferAction` from `front/app/pages/owner/index.vue`, and remove `@transfer` forwarding from `front/app/components/organisms/OwnerVehiclesTab.vue`
- [X] T052 [US5] Complete localized strings (replacing hardcoded English in `OwnerAddCarModal.vue`, adding `transfer_pending_owner`/`transfer_pending_police` and removing stale `transfer_requested` in `ar.json`, adding Owner rejection modal & error keys) in `front/i18n/locales/en.json`, `front/i18n/locales/fr.json`, and `front/i18n/locales/ar.json`

**Checkpoint**: User Story 5 passes UI/i18n tests and works end-to-end across `en`, `fr`, and `ar` (`RTL`) (`SC-005`).

---

## Phase 8: Polish & Cross-Cutting Verification

**Purpose**: Final build, lint, test-suite verification, and quickstart validation across both packages.

- [X] T053 [P] Run `cd functions && pnpm build && pnpm lint && pnpm test:unit` and verify 0 errors
- [X] T054 [P] Run `cd front && pnpm lint && pnpm test` and verify 0 errors
- [X] T055 Run `firebase emulators:exec --only auth,firestore,storage,functions "pnpm -C functions test:emulator"` and validate [quickstart.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/quickstart.md) checklist

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Independent — `T001` and `T002` run in parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 (`T001`/`T002` only for tests; domain files `T003`–`T007` and `T012` run in parallel, followed by `T008` → `T009`/`T010`/`T011`). **Blocks all User Stories (`US1`–`US5`).**
- **User Stories (Phases 3–7)**:
  - **US1 (P1)**, **US2 (P1)**, **US3 (P1)** can run largely in parallel across separate files once Phase 2 completes, though `T036` (transactions in car use cases) touches the same `usecases/car/*.ts` files modified in `T016`–`T020` (run `US1` use-case auth changes before `US3` transactional wrapping, or combine cleanly per file).
  - **US4 (P2)** depends on `US1`/`US3` changes in `request-ownership-transfer.ts`, `approve-transfer.ts`, `request-car-deletion.ts`, and `cancel-car-deletion.ts`.
  - **US5 (P2)** can start backend `check-plate.ts` (`T047`) after Phase 2/US1 and frontend modal/card updates (`T049`–`T052`) after `US2` (`T031`–`T033`).
- **Polish (Phase 8)**: Depends on all desired user stories (`T001`–`T052`) completing.

### Parallel Opportunities
- Within Phase 2: `T003`, `T004`, `T005`, `T006`, `T007`, `T012` are all in distinct files and fully parallelizable.
- Within US1: `T013`, `T014`, `T015`, `T016`, `T017`, `T018` touch separate files and can run in parallel before `T019`/`T020`.
- Within US2: `T021`, `T022`, `T023`, `T024`, `T026`, `T027`, `T029`, `T030`, `T031` are parallelizable across backend rules, storage adapter, and frontend stores/composables.
- Within US3: `T034`, `T035`, `T038`, `T039` can run in parallel alongside `T036`/`T037`.
- Within US5: `T045`, `T046`, `T048`, `T051` can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Launch US2 tests and independent rules/adapter/store tasks together:
Task: "T021 [P] [US2] Write rules-unit-testing suite in functions/tests/emulator/security-rules.spec.ts"
Task: "T022 [P] [US2] Write GetDocumentUrlUseCase unit tests in functions/tests/unit/get-document-url.spec.ts"
Task: "T024 [P] [US2] Implement StorageSignedUrlAdapter in functions/src/infrastructure/adapters/storage/StorageSignedUrlAdapter.ts"
Task: "T026 [P] [US2] Remove ownershipHistory read access from firestore.rules"
Task: "T027 [P] [US2] Set allow read: if false on document prefixes in storage.rules"
Task: "T029 [P] [US2] Role-gate allFinesQuery in front/app/stores/fines.ts"
Task: "T031 [P] [US2] Create useDocumentViewer composable in front/app/composables/useDocumentViewer.ts"
```

---

## Implementation Strategy

### MVP First (P1 Stories: US1 → US2 → US3)
1. Complete **Phase 1 (Setup)** + **Phase 2 (Foundational)** to establish pure domain ports, `TransactionRunner`, `DomainError`, and `firestore.indexes.json`.
2. Complete **Phase 3 (US1)** to lock down caller identity spoofing, role checks, and `retryCar` whitelisting.
3. Complete **Phase 4 (US2)** to revoke Owner A access (`firestore.rules`, `storage.rules`, `getDocumentUrl`, `historicalCars` removal, role-gated listeners).
4. Complete **Phase 5 (US3)** to make all transfers, registrations, and `IssueFineUseCase` atomic with `v3` backfill migration.
5. **STOP and VALIDATE P1**: Run `T053`–`T055` emulator security + concurrency suites before proceeding to P2 UX polish.

### Incremental Completion (P2 Stories: US4 → US5)
6. Complete **Phase 6 (US4)** for full state-machine guards and `'archived'` alignment.
7. Complete **Phase 7 (US5)** for `checkPlate` privacy/debounce, Owner A rejection reason UI, obsolete modal removal, and `en`/`fr`/`ar` (`RTL`) parity.
8. Complete **Phase 8 (Polish)** and follow the deployment order in [quickstart.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/quickstart.md).
