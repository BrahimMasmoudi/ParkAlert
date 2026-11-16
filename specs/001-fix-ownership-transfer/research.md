# Phase 0 Research: Two-Step Ownership Transfer Hardening & Bug Fixes

**Feature**: [spec.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/spec.md) | **Date**: 2026-11-16

## 1. Pure Domain Transaction Abstraction (Hexagonal Compliance)

- **Decision**: Introduce an opaque `TransactionContext` marker type and a `TransactionRunner` port in `functions/src/domain/repositories/transaction.port.ts` (`run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>`), implemented by `FirestoreTransactionRunner` in `functions/src/infrastructure/adapters/persistence/FirestoreTransactionRunner.ts` wrapping `FirestoreConnector.runTransaction(...)`. Repository methods (`getById`, `getByPlateNumber`, `create`, `update`, `addAuditLog`, `hasUnpaidFines`, `updateStatus`, etc.) accept an optional `tx?: TransactionContext`.
- **Rationale**: Keeps `functions/src/domain` and `functions/src/application` 100% free of `firebase-admin` imports while guaranteeing that all reads (`tx.get(...)`) and writes (`tx.set/update/create`) execute inside a single atomic Firestore transaction. Importantly, in Firestore Admin SDK transactions, **all reads must occur before any writes**; Use Cases orchestrating `run()` must execute `getById`/`getByPlateNumber`/`hasUnpaidFines` before calling `create`/`update`/`addAuditLog`.
- **Alternatives considered**:
  - Passing raw `FirebaseFirestore.Transaction` into Use Cases: rejected because it couples `application/` directly to `firebase-admin/firestore`, violating Hexagonal Architecture.
  - Using `WriteBatch` (current `issue-fine.ts` pattern): rejected because batches do not provide optimistic concurrency locks on read documents (`cars/{carId}` or `fines` queries) and cannot serialize `issueFine` against `approveTransfer`.

## 2. Domain Error Hierarchy & Semantic `HttpsError` Mapping

- **Decision**: Define pure domain error classes (`DomainError` with `code`: `'PERMISSION_DENIED' | 'INVALID_ARGUMENT' | 'NOT_FOUND' | 'FAILED_PRECONDITION' | 'ALREADY_EXISTS'`) in `functions/src/domain/errors/domain.error.ts`, and add a shared `mapDomainErrorToHttpsError(error)` helper in `functions/src/infrastructure/entry-points/shared/error-mapper.ts` translating `DomainError` codes to Firebase `HttpsError` codes (`permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`, `already-exists`).
- **Rationale**: Eliminates `new HttpsError('internal', error.message)` across entry points without importing `firebase-functions` into `domain/` or `application/`, enabling reliable client error handling and verifiable `SC-001`/`SC-004` test assertions.
- **Alternatives considered**:
  - Checking error message substrings in entry points: rejected as brittle and inconsistent across use cases.
  - Throwing `HttpsError` directly inside Use Cases: rejected as an infrastructure leak into `application/`.

## 3. Document Storage Privacy (`getDocumentUrl` + Emulator Compatibility)

- **Decision**: Store canonical Firebase Storage object paths (`carteGrise/<uid>/<timestamp>_<filename>` and `transfers/<uid>/<timestamp>_<filename>`) in Firestore instead of `getDownloadURL()` tokenized HTTPS URLs; set `allow read: if false;` on those prefixes in `storage.rules`; and add an authenticated `getDocumentUrl` `onCall` Cloud Function backed by a `DocumentStoragePort` (`StorageSignedUrlAdapter`).
  - In production, `getSignedUrl({ action: 'read', expires })` generates a 5-minute read-only signed URL after verifying live Firestore authorization (`role === 'police'`, `car.ownerId === callerUid`, or `car.transferToOwnerId === callerUid` while `status` is `transfer_pending_owner` or `transfer_pending_police`).
  - In local Firebase Storage Emulator (`STORAGE_EMULATOR_HOST` set, where Admin SDK lacks a service-account private key for IAM `signBlob`), return a short-lived proxy/emulator URL or authenticated base64 data payload via the same `getDocumentUrl` contract so local emulator testing works identically without special-casing UI components.
  - Frontend uses a single `useDocumentViewer` composable that passes `https://` legacy URLs straight through and resolves canonical Storage paths via `getDocumentUrl` on demand.
- **Rationale**: Eliminates `getDownloadURL()` persistent public token bypasses, avoids adding `setCustomUserClaims` + token refresh/backfill to `setUserRole`, checks live Firestore authorization on every open, and preserves backward compatibility with legacy `https://` URLs.
- **Alternatives considered**:
  - Auth custom claims (`request.auth.token.role == 'police'`) + `storage.rules` + client `getBlob()`: rejected because `SetUserRoleUseCase` has no custom-claim provisioning, `setUserRole` currently lacks admin protection, existing Police users lack claims, and role revocations lag until ID token refresh.

## 4. Shared Plate Normalization & `fines` Backfill Strategy

- **Decision**: Extract `normalizePlate(plate: string): string` (`String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '')`) into `functions/src/domain/value-objects/plate.ts` and `front/app/composables/useVehicleValidation.ts`. Store both display `plateNumber` and `plateNumberNormalized` on every `Fine` (`IssueFineUseCase`), query `fines` by `plateNumberNormalized` inside `FirestoreFineRepository.hasUnpaidFines(ownerId, normalizedPlate, tx)`, and add a composite index in `firestore.indexes.json` on `fines` (`ownerId` ASC, `plateNumberNormalized` ASC, `status` ASC). Update `OwnerCarCard.vue` badge filtering to compare normalized plates.
- **Rationale**: Ensures `AB-123-CD` and `AB123CD` match identically across registration, fine issuance, unpaid-fine transfer checks, and UI display.
- **Alternatives considered**:
  - Overwriting `fines.plateNumber` in place to strip dashes: rejected because UI displays formatted plates (`AB-123-CD`) and pre-existing `OwnerCarCard.vue` comparisons expect display formatting unless updated.

## 5. Migrations (`v2__plate_as_id.ts` + `v3__backfill_fines_and_audit_logs.ts`)

- **Decision**: Harden `functions/migrations/v2__plate_as_id.ts` for fresh deployments AND create a new idempotent `functions/migrations/v3__backfill_fines_and_audit_logs.ts` for environments where `fireway` has already marked `v2` as applied. Both detect normalized-plate collisions without overwriting/merging existing `cars/{normalized}` documents (recording collisions in `migration_conflicts` for Police review), chunk `car_audit_logs.carId` updates in batches of `<= 450` writes, and backfill `fines.plateNumberNormalized`.
- **Rationale**: `fireway` skips previously executed migration versions; a `v3` script guarantees existing staging/prod databases receive the `fines` and `car_audit_logs` backfills safely.
- **Alternatives considered**:
  - Modifying `v2__plate_as_id.ts` only: rejected because `fireway` will not re-run `v2` on already-migrated environments.

## 6. Automated Testing Strategy

- **Decision**: Add `vitest` (TypeScript-native, fast) in `functions/` for:
  1. Pure Use Case unit tests with in-memory repository/transaction mocks (fast, zero network).
  2. Firebase Emulator Suite integration & concurrency tests (`Promise.all` racing `approveTransfer` vs `approveTransfer`, `approveTransfer` vs `issueFine`, `addCar` vs `addCar`) and `@firebase/rules-unit-testing` tests for `firestore.rules` and `storage.rules`.
  And add `vitest` in `front/` for store gating (`cars.ts`, `fines.ts`), `OwnerAddCarModal` debounce/sequence logic, and locale key parity (`en.json`, `fr.json`, `ar.json`).
- **Rationale**: Directly verifies `SC-001` through `SC-005` where no automated test runner currently exists in `front/package.json` or `functions/package.json`.
- **Alternatives considered**:
  - Manual emulator smoke testing only: rejected because race conditions (`SC-004`) and rule edge cases (`SC-002`) cannot be reliably regression-tested manually.
