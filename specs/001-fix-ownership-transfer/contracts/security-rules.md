# Security Rules & Client Listener Contracts

## 1. `firestore.rules`

### `/cars/{carId}`
Remove `request.auth.uid in resource.data.ownershipHistory`:
```text
match /cars/{carId} {
  allow read: if isSecureRequest() && (
    getUserData().role == 'police' ||
    (getUserData().role == 'owner' && resource.data.ownerId == request.auth.uid)
  );
  allow write: if false;
}
```
- **Effect**: Upon `approveTransfer` setting `ownerId = Owner B`, Owner A immediately loses read access to `cars/{carId}` and receives `permission-denied` on direct document gets or queries.

### `/fines/{fineId}` (Unchanged — Preserves Owner A Fine History)
```text
match /fines/{fineId} {
  allow read: if isSecureRequest() && (
    getUserData().role == 'police' ||
    (getUserData().role == 'owner' && resource.data.ownerId == request.auth.uid)
  );
  allow write: if false;
}
```

### `/car_audit_logs/{logId}` & `/migration_conflicts/{id}`
- Covered by default-deny `match /{document=**} { allow read, write: if false; }`.

---

## 2. `storage.rules`

```text
match /carteGrise/{ownerId}/{fileName} {
  allow read: if false;
  allow write: if isSecureRequest()
               && request.auth.uid == ownerId
               && request.resource.size < 10 * 1024 * 1024
               && (request.resource.contentType.matches('image/.*') || request.resource.contentType == 'application/pdf');
}

match /transfers/{userId}/{fileName} {
  allow read: if false;
  allow write: if isSecureRequest()
               && request.auth.uid == userId
               && request.resource.size < 10 * 1024 * 1024
               && (request.resource.contentType.matches('image/.*') || request.resource.contentType == 'application/pdf');
}
```
- All document reads go exclusively through the `getDocumentUrl` Cloud Function (no `getDownloadURL()` tokens persisted in Firestore).

---

## 3. Client Store Listener Gating (`front/app/stores/`)
- `stores/cars.ts`:
  - Remove `historicalCarsRef`, `historicalCars`, and `historicalCarsLoading`.
  - Gate `pendingCarsRef` on `authStore.userRole === 'police'` (return `null` otherwise so `useCollection` does not attach a collection-wide listener on the Owner Dashboard).
- `stores/fines.ts`:
  - Gate `allFinesQuery` on `authStore.userRole === 'police'` (return `null` otherwise).
