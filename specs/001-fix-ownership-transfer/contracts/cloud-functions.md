# Cloud Functions `onCall` Contracts

**Region**: `europe-west3` | **App Check**: `enforceAppCheck: true` | **Auth**: All endpoints derive caller identity exclusively from `request.auth.uid` (payload identity fields are ignored/overwritten).

## Common Error Codes (`HttpsError`)
- `unauthenticated`: Missing `request.auth.uid`.
- `permission-denied`: Caller role or ownership/stage mismatch.
- `invalid-argument`: Missing/malformed input, invalid path prefix or `..`, out-of-bounds rejection reason (`<3` or `>500` trimmed chars), or disallowed field change (`plateNumber` on `retryCar`).
- `not-found`: Target vehicle/report/user document does not exist.
- `failed-precondition`: Invalid vehicle status transition, unpaid fines blocking transfer, or missing `transferToOwnerId`/`transferCarteGriseUrl`.
- `already-exists`: Vehicle with normalized plate already registered (`addCar`).

---

## Vehicle & Transfer Endpoints

### `checkPlate`
- **Role**: `owner`
- **Request**: `{ plateNumber: string }`
- **Response**:
  ```ts
  {
    available: boolean;
    eligibleForTransfer: boolean;
    reason?: 'OWNED_BY_CALLER' | 'INELIGIBLE_STATUS' | 'TRANSFER_IN_PROGRESS';
  }
  ```
- **Privacy invariant**: Never returns `ownerId`, masked UID, or raw `car.status`.

### `addCar`
- **Role**: `owner`
- **Request**: `{ plateNumber: string; brand: string; model: string; color: string; carteGriseUrl: string }`
- **Validation**: `carteGriseUrl` must match `^carteGrise/<callerUid>/[^/]+$` (no `..`). Runs inside `runTransaction` using `tx.create()` on `cars/{normalizedPlate}` (`already-exists` if present).
- **Response**: `{ ok: true, carId: string }`

### `retryCar`
- **Role**: `owner` (`car.ownerId === callerUid`)
- **Request**: `{ carId: string; plateNumber?: string; brand: string; model: string; color: string; carteGriseUrl: string }` (extra fields ignored; if `plateNumber` is provided, `normalizePlate(plateNumber)` must match `car.plateNumberNormalized` or return `invalid-argument`)
- **Validation**: `car.status === 'rejected'`; `carteGriseUrl` matches `^carteGrise/<callerUid>/[^/]+$`. Runs inside `runTransaction` with audit log.
- **Response**: `{ ok: true }`

### `requestOwnershipTransfer`
- **Role**: `owner` (`!== car.ownerId`)
- **Request**: `{ plateNumber: string; carteGriseUrl: string }`
- **Validation**: `car.status === 'active'`; `carteGriseUrl` matches `^transfers/<callerUid>/[^/]+$`; transactional `hasUnpaidFines(car.ownerId, car.plateNumberNormalized, tx) === false`.
- **Response**: `{ ok: true }`

### `acknowledgeTransfer`
- **Role**: `owner` (`=== car.ownerId`)
- **Request**: `{ carId: string }`
- **Validation**: `car.status === 'transfer_pending_owner'`. Transactional status update to `'transfer_pending_police'` + audit log.
- **Response**: `{ ok: true }`

### `approveTransfer`
- **Role**: `police`
- **Request**: `{ carId: string }`
- **Validation**: `car.status === 'transfer_pending_police'`; `car.transferToOwnerId` and `car.transferCarteGriseUrl` non-empty; transactional `hasUnpaidFines(car.ownerId, car.plateNumberNormalized, tx) === false`. Sets `ownerId = transferToOwnerId`, `carteGriseUrl = transferCarteGriseUrl`, `status = 'active'`, clears temporary transfer fields, writes audit log atomically.
- **Response**: `{ ok: true }`

### `rejectTransfer`
- **Role**: Stage-scoped — `owner` (`=== car.ownerId`) when `car.status === 'transfer_pending_owner'`; `police` when `car.status === 'transfer_pending_police'`.
- **Request**: `{ carId: string; reason: string }`
- **Validation**: Trimmed `reason.length` in `3..500`. Sets `status = 'active'`, records `transferRejectionReason`, clears `transferToOwnerId` and `transferCarteGriseUrl`, writes audit log atomically.
- **Response**: `{ ok: true }`

### `approveCar` / `rejectCar`
- **Role**: `police`
- **Request**: `{ carId: string }` (and `{ reason: string }` for `rejectCar`, trimmed `3..500`)
- **Validation**: `car.status === 'activation_pending'`; executes transactionally with audit log.

### `requestCarDeletion` / `cancelCarDeletion` / `approveCarDeletion`
- `requestCarDeletion`: `owner` (`=== car.ownerId`), `car.status` in `['active', 'rejected']` → saves `preDeletionStatus = car.status`, sets `'deletion_requested'`.
- `cancelCarDeletion`: `owner` (`=== car.ownerId`), `car.status === 'deletion_requested'` → restores `car.preDeletionStatus ?? 'active'`, clears `preDeletionStatus` and `deletionRequestedAt`.
- `approveCarDeletion`: `police`, `car.status === 'deletion_requested'` → sets `'archived'`.

### `issueFine`
- **Role**: `police`
- **Request**: `{ reportId: string; ownerId: string; plateNumber: string; amount: number; notes?: string }`
- **Transaction**: Replaces `WriteBatch` with `runTransaction`: reads `reports/{reportId}` and `cars/{normalizePlate(plateNumber)}`, verifies `car` exists, `car.ownerId === request.ownerId`, `car.status !== 'archived'`, updates report to `'investigated'`, creates `fines/{id}` with `plateNumberNormalized`.

### `getDocumentUrl` *(New)*
- **Role**: `police` OR current `owner` authorized for the document
- **Request**: `{ carId: string; documentKind: 'active' | 'pendingTransfer' }` (or `{ path: string }` verified against `car` fields)
- **Authorization**:
  - `police`: allowed for any existing `car`'s `carteGriseUrl` or `transferCarteGriseUrl`.
  - `owner`: allowed for `'active'` ONLY when `car.ownerId === callerUid`; allowed for `'pendingTransfer'` ONLY when `car.status` is `'transfer_pending_owner'` or `'transfer_pending_police'` and (`car.ownerId === callerUid` or `car.transferToOwnerId === callerUid`).
  - Former owners (`Owner A` after approval) receive `permission-denied`.
- **Response**: `{ url: string; expiresAt: number }` (5-minute signed URL in prod; emulator-compatible read URL/data URI when `STORAGE_EMULATOR_HOST` is set).
