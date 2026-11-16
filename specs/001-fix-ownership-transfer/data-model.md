# Phase 1 Data Model: Two-Step Ownership Transfer Hardening & Bug Fixes

**Feature**: [spec.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/spec.md) | **Date**: 2026-11-16

## 1. Entities & Schema Updates

### `Car` (`cars/{plateNumberNormalized}`)
| Field | Type | Validation / Invariant | Notes |
|---|---|---|---|
| `id` | `string` | Immutable; equals `plateNumberNormalized` | Set at creation via `tx.create()` |
| `ownerId` | `string` | Valid `users` UID with `role === 'owner'` | Updated atomically on `approveTransfer` |
| `plateNumber` | `string` | Uppercase formatted plate (e.g. `AB-123-CD`); immutable on `retryCar` | Display value |
| `plateNumberNormalized` | `string` | `normalizePlate(plateNumber)` (`^[A-Z0-9]+$`) | Lookup & uniqueness key |
| `brand`, `model`, `color` | `string` | Non-empty trimmed strings | Mutable on `retryCar` via whitelist only |
| `carteGriseUrl` | `string` | Canonical Storage path `carteGrise/<uid>/...` or `transfers/<uid>/...` (legacy `https://` tolerated read-only) | Replaced by `transferCarteGriseUrl` on approval |
| `status` | `CarStatus` | `'activation_pending' \| 'active' \| 'rejected' \| 'deletion_requested' \| 'archived' \| 'transfer_pending_owner' \| 'transfer_pending_police'` | Frontend aligned (`'archived'`, replacing `'deleted'`) |
| `preDeletionStatus` | `'active' \| 'rejected' \| null` | Captured in `requestCarDeletion`; restored by `cancelCarDeletion` and cleared (`FieldValue.delete()`) | Prevents forcing `activation_pending` on cancel |
| `transferToOwnerId` | `string \| null` | Must differ from `ownerId` and hold `role === 'owner'` | Cleared on `approveTransfer` / `rejectTransfer` |
| `transferCarteGriseUrl` | `string \| null` | Canonical path `transfers/<transferToOwnerId>/...` | Cleared on `approveTransfer` / `rejectTransfer` |
| `transferRequestedAt` | `Timestamp \| null` | Server timestamp when initiated | Cleared or overwritten on next transfer |
| `transferRejectionReason` | `string \| null` | Trimmed length `3..500` on rejection | Cleared when a new transfer starts |
| `ownershipHistory` | `string[]` (server-only / deprecated for rules) | **Not readable via client Firestore rules**; historical audit lives in `car_audit_logs` | Client `historicalCars` query removed |

### `Fine` (`fines/{fineId}`)
| Field | Type | Validation / Invariant | Notes |
|---|---|---|---|
| `id` | `string` | Auto-generated document ID | — |
| `reportId` | `string` | Linked report ID | — |
| `ownerId` | `string` | Must match `car.ownerId` at issuance inside `IssueFineUseCase` transaction | Owner A keeps read access post-transfer |
| `plateNumber` | `string` | Uppercase display plate | Preserved for UI display |
| `plateNumberNormalized` | `string` | `normalizePlate(plateNumber)` | **New field**; indexed and backfilled in `v3` |
| `amount` | `number` | `> 0` | — |
| `status` | `'unpaid' \| 'paid'` | Blocks transfers while `'unpaid'` | Checked via `transaction.get` |

### `CarAuditLog` (`car_audit_logs/{logId}`)
- Fields: `carId` (normalized plate ID), `actorId` (verified `request.auth.uid`), `action`, `timestamp` (`serverTimestamp()`), optional `details`, optional `reason`.
- Written **inside the same Firestore transaction** (`tx.create(auditRef, ...)`) as the `cars/{carId}` mutation.
- Client `firestore.rules`: default-deny (`allow read, write: if false`).

### `MigrationConflict` (`migration_conflicts/{conflictId}`)
- Written by `v2`/`v3` migrations only when two distinct `cars` documents share the same `plateNumberNormalized` with non-identical metadata/owners so neither document is overwritten or silently merged.

## 2. State Machine Transitions (`CarStatus`)

| From Status | Action | Allowed Role / Actor | Preconditions | Target Status |
|---|---|---|---|---|
| *(none)* | `addCar` | `owner` | No existing `cars/{normalized}`; valid `carteGrise/<uid>/...` path | `activation_pending` |
| `activation_pending` | `approveCar` / `rejectCar` | `police` | Non-empty reason on reject | `active` / `rejected` |
| `rejected` | `retryCar` | `owner` (`car.ownerId`) | Whitelisted fields only; `plateNumber` unchanged; valid `carteGrise/<uid>/...` | `activation_pending` |
| `active` or `rejected` | `requestCarDeletion` | `owner` (`car.ownerId`) | Records `preDeletionStatus = car.status` | `deletion_requested` |
| `deletion_requested` | `cancelCarDeletion` | `owner` (`car.ownerId`) | Restores `car.preDeletionStatus ?? 'active'` | `active` or `rejected` |
| `deletion_requested` | `approveCarDeletion` | `police` | — | `archived` |
| `active` | `requestOwnershipTransfer` | `owner` (`!== car.ownerId`) | `hasUnpaidFines(car.ownerId, normalized) === false`; valid `transfers/<uid>/...` | `transfer_pending_owner` |
| `transfer_pending_owner` | `acknowledgeTransfer` | `owner` (`=== car.ownerId`) | — | `transfer_pending_police` |
| `transfer_pending_owner` | `rejectTransfer` | `owner` (`=== car.ownerId`) | Trimmed `reason` length `3..500` | `active` |
| `transfer_pending_police` | `approveTransfer` | `police` | `transferToOwnerId` & `transferCarteGriseUrl` present; `hasUnpaidFines(car.ownerId, normalized) === false` | `active` (new `ownerId = transferToOwnerId`) |
| `transfer_pending_police` | `rejectTransfer` | `police` | Trimmed `reason` length `3..500` | `active` |

## 3. Required Firestore Composite Indexes (`firestore.indexes.json`)
Add index for transactional `hasUnpaidFines`:
- Collection group: `fines`, queryScope: `COLLECTION`
- Fields: `ownerId` (`ASCENDING`), `plateNumberNormalized` (`ASCENDING`), `status` (`ASCENDING`)
