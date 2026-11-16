# Validation Quickstart: Ownership Transfer Hardening & Bug Fixes

**Feature**: [spec.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/spec.md) | **Plan**: [plan.md](file:///Users/utilisateur/projects/ParkAlert/specs/001-fix-ownership-transfer/plan.md)

## 1. Prerequisites
- Node.js 24 (functions) / 20+, `pnpm`, Firebase CLI (`firebase-tools`) with Local Emulator Suite (`auth:9099`, `functions:5001`, `firestore:8080`, `storage:9199`).
- Feature dependencies installed (`cd functions && pnpm install`, `cd front && pnpm install`).

## 2. Build & Static Checks
Run after backend and frontend edits:
```bash
cd functions && pnpm build && pnpm lint
cd ../front && pnpm lint
```
Expected: zero TypeScript errors and zero ESLint errors across both packages.

## 3. Automated Unit & Emulator Verification
- **Backend unit tests** (use cases, plate normalization, field whitelisting, error mapping):
  ```bash
  cd functions && pnpm test:unit
  ```
- **Firebase Emulator Suite tests** (Firestore/Storage rules + concurrent `Promise.all` transactions for `approveTransfer`, `issueFine`, `addCar`):
  ```bash
  firebase emulators:exec --only auth,firestore,storage,functions "pnpm -C functions test:emulator"
  ```
- **Frontend unit tests** (role-gated store listeners, debounced `checkPlate` sequence guard, `en`/`fr`/`ar` locale key parity):
  ```bash
  cd front && pnpm test
  ```

## 4. End-to-End Manual Walkthrough (Local Emulators)
1. Start local stack (`cd front && sh ./dev.sh`), verifying `v2` and `v3` migrations complete cleanly.
2. **Owner A** registers `AB-123-CD` (`image` or `PDF`); **Police** approves (`active`). Verify `carteGriseUrl` stores a canonical path and opens via `getDocumentUrl`.
3. **Police** issues an unpaid fine to Owner A for `AB-123-CD`.
4. **Owner B** opens Add Vehicle, types `AB123CD` → debounced `checkPlate` switches to transfer mode without exposing any `ownerId`; submission is blocked by the unpaid fine (`SC-003`).
5. **Owner A** pays the fine; **Owner B** uploads a transfer document (`transfers/<ownerB>/...`) and submits transfer (`transfer_pending_owner`).
6. Verify **Owner A** can reject with a 3–500 char reason (returning vehicle to `active`), then re-submit and have **Owner A** acknowledge (`transfer_pending_police`).
7. **Police** approves transfer → Owner B sees the vehicle as `Active`, Owner A immediately loses access to the vehicle and Owner B's document while keeping their own fine history, and zero `permission-denied` console errors appear on Owner Dashboard.
8. Switch UI language across `en`, `fr`, and `ar` (`RTL`) and confirm all labels, statuses, and modals render with zero missing keys.

## 5. Production / Staging Deployment Order
1. Deploy `firestore.indexes.json` (wait for `fines` composite index to build).
2. Deploy Cloud Functions (`functions/`).
3. Run `fireway` migrations (`v2` / `v3__backfill_fines_and_audit_logs.ts`) and verify zero unresolved `migration_conflicts`.
4. Deploy updated frontend (`front/`) with `historicalCars` removed and role-gated listeners.
5. Deploy tightened `firestore.rules` and `storage.rules`.
