# Implementation Plan: Two-Step Ownership Transfer Hardening & Bug Fixes

**Branch**: `changer-transfer-way` | **Date**: 2026-11-16 | **Spec**: [spec.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/spec.md)

**Input**: Feature specification from `/specs/001-fix-ownership-transfer/spec.md`

## Summary

Harden and fix the two-step vehicle ownership transfer workflow on `changer-transfer-way` across backend, security rules, migrations, and frontend:
1. **Identity, Role & Field Isolation**: Derive caller IDs exclusively from `request.auth.uid`, enforce role/stage checks across all vehicle and transfer use cases (`UserRepository`), whitelist mutable fields in `RetryCarUseCase`, and map domain errors to semantic `HttpsError` codes.
2. **Post-Transfer Access Revocation & Document Privacy**: Remove `ownershipHistory` read access from `firestore.rules`, remove `historicalCars` and role-gate `pendingCarsRef`/`allFinesQuery` in Pinia stores, store canonical Storage paths instead of `getDownloadURL()` tokens, set `allow read: if false` on document prefixes in `storage.rules`, and serve files via a new `getDocumentUrl` Cloud Function returning short-lived signed URLs.
3. **Atomic Concurrency & Plate Normalization**: Introduce a pure domain `TransactionRunner` port (`runTransaction` + `transaction.get`) shared across transfer use cases, `addCar`, `retryCar`, deletion lifecycle, and `IssueFineUseCase` (replacing `WriteBatch`), centralize `normalizePlate()`, add `fines.plateNumberNormalized` + composite index, and add `v3__backfill_fines_and_audit_logs.ts`.
4. **UI & i18n Fixes**: Add Owner A rejection reason modal, debounced `checkPlate` with sequence guard, document-viewer resolver for paths and legacy HTTPS URLs, PDF + image input support, `'archived'` status alignment, obsolete `OwnerTransferCarModal` cleanup, and full `en`/`fr`/`ar` (`RTL`) translations, backed by Vitest unit and Firebase Emulator integration tests.

## Technical Context

**Language/Version**: TypeScript `5.9.2` (Node.js `24` for Firebase Cloud Functions v2; Nuxt `4.1.2` SPA for frontend)
**Primary Dependencies**: `firebase-functions` v6, `firebase-admin` v13, `fireway` `1.1.0`, `nuxt` `4.1.2`, `@nuxt/ui` `3.3.3`, `pinia` `3.0.4`, `nuxt-vuefire` `1.1.2`, `@nuxtjs/i18n` `10.3.0`
**Storage**: Cloud Firestore (`eur3`), Firebase Storage (`transfers/` and `carteGrise/`), Firebase Auth
**Testing**: Adding `vitest` (backend unit tests + Firebase Emulator Suite / `@firebase/rules-unit-testing` concurrency & rules tests; frontend unit tests for stores, debounce logic, and i18n parity); existing `tsc` and `eslint` gates
**Target Platform**: Web SPA (`ssr: false` on Firebase Hosting) + Firebase Cloud Functions v2 (`europe-west3`)
**Project Type**: Full-stack Firebase + Nuxt 4 web application (`front/` + `functions/`)
**Performance Goals**: Debounced plate lookup (`~300ms`) with stale-request cancellation; single-vehicle-scoped Firestore transactions without collection-wide locks
**Constraints**: Firestore transactions require all `transaction.get` reads before writes and `<= 500` ops per batch/transaction; `storage.rules` cannot read Firestore; `fireway` skips already-applied `v2` migrations on existing environments; strict deployment ordering required before tightening `firestore.rules`
**Scale/Scope**: 13 Cloud Functions (`addCar`, `retryCar`, `checkPlate`, `requestOwnershipTransfer`, `acknowledgeTransfer`, `approveTransfer`, `rejectTransfer`, `approveCar`, `rejectCar`, `requestCarDeletion`, `cancelCarDeletion`, `approveCarDeletion`, `issueFine`, `getDocumentUrl`), Firestore & Storage security rules, 2 migration scripts, 2 Pinia stores, 5+ Vue components, 3 i18n locale files

## Constitution Check

*Evaluated against `.specify/memory/constitution.md` (ParkAlert Constitution v1.0.0).*

### Pre-Design & Post-Design Gate Evaluation
| Principle | Pre-Design Status | Post-Design Status | Notes |
|---|---|---|---|
| **I. Hexagonal Backend Separation** | PASS | PASS | `TransactionRunner`, `TransactionContext`, `DomainError`, `DocumentStoragePort`, and `normalizePlate()` live in `functions/src/domain/` with zero `firebase-admin` or `firebase-functions` imports; `FirestoreTransactionRunner`, `StorageSignedUrlAdapter`, and `mapDomainErrorToHttpsError` stay in `infrastructure/`. |
| **II. Server-Authoritative Writes & Least-Privilege Security** | PASS (Fixes gaps) | PASS | Eliminates direct client read leaks (`ownershipHistory`, `getDownloadURL()` tokens, broad `storage.rules`), enforces role/ownership in Use Cases, prevents UID spoofing and `retryCar` field injection. |
| **III. Atomic Design & Role-Separated Frontend** | PASS | PASS | Removes dead `OwnerTransferCarModal`, adds Owner rejection modal/prompt and `useDocumentViewer` composable without embedding privileged logic client-side, role-gates Police listeners in Pinia stores. |
| **IV. Multilingual & RTL-First Inclusivity** | PASS (Fixes gaps) | PASS | Moves hardcoded modal/toast strings to `$t(...)` and completes `en.json`, `fr.json`, and RTL `ar.json` parity. |
| **V. Spec-Driven & Fresh-Eyes Design Verification** | PASS | PASS | Spec created via `/speckit-specify`, clarified via `/speckit-clarify`, and audited through 2 rounds of EGM Goldfish Review (`/egm-review-loop`) before planning. |
| **VI. Simplicity, Code Reuse & Quality Gates** | PASS | PASS | Reuses shared `normalizePlate`, shared error mapper, and shared `TransactionRunner` across all car/fine use cases; verified via `tsc`, `eslint`, and new `vitest` + Emulator test suites. |

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-ownership-transfer/
├── spec.md                       # Clarified & Goldfish-reviewed specification
├── plan.md                       # This file (/speckit-plan output)
├── research.md                   # Phase 0 architectural decisions & trade-offs
├── data-model.md                 # Entities, state machine, composite indexes
├── quickstart.md                 # Build, test, emulator, and deploy verification guide
├── checklists/
│   └── requirements.md           # Spec quality validation checklist
└── contracts/
    ├── cloud-functions.md        # All onCall request/response/error contracts
    └── security-rules.md         # firestore.rules, storage.rules, & store listener gating
```

### Source Code (repository root)

```text
firestore.rules                                        # Remove ownershipHistory read access on /cars
firestore.indexes.json                                 # Add fines (ownerId, plateNumberNormalized, status) index
storage.rules                                          # Set allow read: if false on /carteGrise and /transfers

functions/
├── package.json                                       # Add vitest test scripts & devDependencies
├── migrations/
│   ├── v2__plate_as_id.ts                             # Harden fresh migration (no cross/same-owner merges)
│   └── v3__backfill_fines_and_audit_logs.ts           # New idempotent migration for existing environments
└── src/
    ├── domain/
    │   ├── entities/
    │   │   ├── car.entity.ts                          # Add preDeletionStatus
    │   │   └── fine.entity.ts                         # Add plateNumberNormalized
    │   ├── errors/domain.error.ts                     # Pure DomainError & error codes
    │   ├── repositories/
    │   │   ├── transaction.port.ts                    # Pure TransactionContext & TransactionRunner
    │   │   ├── storage.port.ts                        # DocumentStoragePort for signed URLs
    │   │   ├── car.repository.ts                      # Accept optional tx?: TransactionContext
    │   │   ├── fine.repository.ts                     # Accept optional tx?: TransactionContext
    │   │   ├── report.repository.ts                   # Accept optional tx?: TransactionContext
    │   │   └── user.repository.ts                     # Accept optional tx?: TransactionContext
    │   └── value-objects/plate.ts                     # Shared normalizePlate() & Storage path validators
    ├── application/usecases/
    │   ├── car/
    │   │   ├── add-car.ts                             # Transactional tx.create(), path validation
    │   │   ├── retry-car.ts                           # Field whitelist, immutable plate, tx, path validation
    │   │   ├── check-plate.ts                         # Owner role check, caller-relative response
    │   │   ├── request-ownership-transfer.ts          # Active guard, Owner check, normalized fines, tx
    │   │   ├── acknowledge-transfer.ts                # Transactional status + audit log
    │   │   ├── approve-transfer.ts                    # Police check, required transfer fields, tx
    │   │   ├── reject-transfer.ts                     # Stage-scoped Owner/Police check, 3..500 reason, tx
    │   │   ├── approve-car.ts / reject-car.ts         # Police role check, tx
    │   │   ├── request-car-deletion.ts                # Allow active/rejected only, save preDeletionStatus, tx
    │   │   ├── cancel-car-deletion.ts                 # Restore preDeletionStatus, Owner role check, tx
    │   │   └── get-document-url.ts                    # Authorized short-lived signed URL use case
    │   └── fine/issue-fine.ts                         # Transactional car ownerId/status validation + plateNumberNormalized
    └── infrastructure/
        ├── adapters/
        │   ├── persistence/
        │   │   ├── FirestoreTransactionRunner.ts      # Wraps FirestoreConnector.runTransaction
        │   │   ├── FirestoreCarRepository.ts          # Uses tx.get/create/update when tx provided
        │   │   ├── FirestoreFineRepository.ts         # Queries plateNumberNormalized via tx.get
        │   │   ├── FirestoreReportRepository.ts       # Uses tx.update when tx provided
        │   │   └── FirestoreUserRepository.ts         # Uses tx.get when tx provided
        │   └── storage/StorageSignedUrlAdapter.ts     # Prod getSignedUrl + local emulator fallback
        └── entry-points/
            ├── shared/error-mapper.ts                 # Maps DomainError -> HttpsError
            ├── index.ts                               # Export getDocumentUrl + transactionRunner
            ├── car/*.ts                               # Fix ...request.data spread order, map errors, add get-document-url.ts
            └── fine/issue-fine.ts                     # Replace getBatch() with transactionRunner

front/
├── package.json                                       # Add vitest test script & devDependencies
├── i18n/locales/{en,fr,ar}.json                       # Complete transfer, modal, error, and status keys
└── app/
    ├── composables/
    │   ├── useVehicleValidation.ts                    # Shared normalizePlate()
    │   └── useDocumentViewer.ts                     # Resolves Storage paths via getDocumentUrl + legacy HTTPS
    ├── stores/
    │   ├── cars.ts                                    # Remove historicalCars, role-gate pendingCarsRef, align archived, add getDocumentUrl
    │   └── fines.ts                                   # Role-gate allFinesQuery to police
    ├── pages/owner/index.vue                          # Remove OwnerTransferCarModal
    └── components/
        ├── molecules/OwnerCarCard.vue                 # Owner reject reason prompt, normalized fine match, document viewer, drop transfer emit
        └── organisms/
            ├── OwnerAddCarModal.vue                   # Debounced checkPlate + seq guard, PDF+image accept, Storage paths, i18n, reset
            ├── OwnerVehiclesTab.vue                   # Remove historicalCars section & transfer emit
            ├── OwnerTransferCarModal.vue              # Delete obsolete modal
            ├── PoliceCarsTab.vue                      # Document viewer resolver
            └── PoliceCarReviewModal.vue               # Document viewer resolver
```

**Structure Decision**: Existing ParkAlert dual-package layout (`front/` Nuxt 4 SPA + `functions/` Firebase Cloud Functions v2 Hexagonal Architecture + root Firebase rules/indexes). No new packages or services introduced.

## Complexity Tracking

No Constitution violations require justification.
