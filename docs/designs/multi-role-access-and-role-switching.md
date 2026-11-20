# Multi-Role Access & Client-Side Role Switching

* **Author:** BrahimMasmoudi
* **Status:** Implemented
* **Date:** 2026-11-19

## Overview

ParkAlert supports three roles: parking agents (`agent`), police officers (`police`), and vehicle owners (`owner`). Today each user account holds one mutually exclusive role, which prevents police officers and parking agents from registering personal vehicles, receiving vehicle transfers, or paying and disputing personal fines without creating a separate account.

This design replaces the single `role` field on each user record with an allowed `roles` list (`['owner']`, `['police', 'owner']`, or `['agent', 'owner']`). Multi-role users choose which workspace to enter when signing in or visiting `/` and switch workspaces from the app header via client-side routing (`route.meta.role`) and role-gated data listeners, while single-role owners stay locked to `'owner'`. Server-side rules and Cloud Functions verify `roles` membership, prevent post-onboarding privilege escalation, and block police officers from taking enforcement or approval actions on vehicles, transfers, reports, or fines tied to their own user ID.

## The Problem

1. **Police and agents cannot use owner features on their account:** Every user record stores a single `role` string (`'agent' | 'police' | 'owner'`). All owner actions (`addCar`, `CheckPlateAvailabilityUseCase`, `requestOwnershipTransfer`, and owner reads in `firestore.rules`) reject users whose `role` is `'police'` or `'agent'`. Meanwhile, `ownersQuery`, `availableOwners`, `allOwners`, and `UserSelectMenu.vue` remain unused legacy directory code in the frontend (since transfers now initiate by plate lookup) while keeping an unnecessary full-collection `users` listener open.
2. **Existing user endpoints allow post-onboarding privilege escalation:** `SetUserRoleUseCase` overwrites existing user records without checking whether a role is already assigned, and `UpdateUserProfileUseCase` passes raw client payload keys into Firestore without a field allowlist—allowing an existing user to overwrite their role or `uid`.
3. **No conflict-of-interest checks exist for police actions:** None of the police approval, transfer, fine, dispute, or report-dismissal endpoints check whether the target vehicle or fine belongs to the acting officer. Allowing officers to hold `'owner'` capabilities without server-side self-enforcement checks would let an officer approve their own car, approve a transfer into their own account, dismiss reports on their own plate, or cancel their own fines.
4. **Client listeners are inconsistently gated:** Some Pinia queries (`pendingReportsQuery`, `agentReportsQuery`, `carsRef`, `ownerFinesQuery`) are not gated by active workspace mode or role, causing unnecessary reads, cross-workspace data mixing, or `permission-denied` listener errors when a listener subscribes under a workspace or legacy role mismatch.

## Goals

* **Multi-role capability assignment:** Replace `users/{uid}.role` with `users/{uid}.roles` (`UserRole[]`), automatically granting `'owner'` alongside `'police'` (`['police', 'owner']`) or `'agent'` (`['agent', 'owner']`) during first-time onboarding while keeping `'owner'` accounts locked to `['owner']`.
* **Workspace separation in the UI:** Prompt multi-role users when signing in or opening `/` to choose their starting workspace, provide a header workspace switcher for multi-role users only, restrict rendered data and role-specific Firestore listeners to the current route's workspace, and remove dead owner-directory code (`ownersQuery`, `UserSelectMenu.vue`).
* **Multi-tab independence:** Keep active workspace selection client-side so a user can open their personal `'owner'` view in one browser tab and their `'police'` or `'agent'` view in another without breaking listeners or forcing redirects.
* **Privilege-escalation prevention:** Make onboarding role assignment write-once, reject disallowed fields and non-string field types in `updateUserProfile`, fix `uid` overwrite in the `updateUserProfile` entry point, and enforce `roles` membership across server endpoints.
* **Police non-self-enforcement:** Block a police officer on the backend from approving, rejecting, deleting, or transferring vehicles where they are the current owner or incoming buyer (`ownerId` or `transferToOwnerId`), issuing fines or resolving disputes on their own vehicles/fines, or dismissing violation reports targeting their own registered plate—and disable officer-owned actions in the Police UI.
* **Staged data migration:** Backfill existing `users` records from singular `role` to `roles` via Fireway migrations in `functions/migrations/` without locking out active sessions.

## Non-Goals

* **Server-stored `activeRole` or `switchActiveRole` callable:** Active workspace selection stays client-side; server permissions authorize against permanent `roles` membership plus conflict-of-interest checks.
* **Combined `police` + `agent` accounts:** A user holds at most one enforcement role (`'police'` or `'agent'`) plus `'owner'`, never both `'police'` and `'agent'`.
* **Post-onboarding role upgrades or admin verification for enforcement signup:** Single-role `'owner'` users cannot upgrade to `'police'` or `'agent'`, and first-time onboarding remains open to selecting `'police'` or `'agent'` per current workflow.
* **Agent self-reporting conflict checks:** Blocking an agent from reporting or editing a report on their own plate is explicitly excluded.
* **Merged multi-role dashboards:** Personal vehicle management and police/agent workflows stay on separate routes (`/owner`, `/police`, `/agent`).
* **Role lookups inside `storage.rules`:** Storage upload rules remain UID-scoped; Cloud Functions enforce `roles` when registering assets and generating signed URLs.

## Open Questions

None. All architectural questions have been resolved and incorporated into the Technical Plan below.

## Critical User Journeys (CUJs)

### CUJ 1: First-Time Onboarding as Police or Agent

* **Given:** A newly authenticated user without an existing `roles` entry on `users/{uid}`.
* **When:** The user visits `/onboarding` and selects `'police'` (or `'agent'`).
* **Then:** `setUserRole` atomically initializes `roles: ['police', 'owner']` (or `['agent', 'owner']`) and routes the user to `/police` (or `/agent`). Subsequent calls to `setUserRole` by the same UID fail with `ALREADY_EXISTS`.

### CUJ 2: First-Time Onboarding & Lock-In as Single-Role Owner

* **Given:** A newly authenticated user without an existing `roles` entry on `users/{uid}`.
* **When:** The user selects `'owner'` on `/onboarding`.
* **Then:** `setUserRole` initializes `roles: ['owner']` and routes to `/owner`. No role switcher is displayed in `AppHeader.vue`, navigating to `/police` or `/agent` redirects back to `/owner`, and attempts to call `setUserRole` again or send `roles`/`role`/`uid` to `updateUserProfile` are rejected server-side.

### CUJ 3: Multi-Role Entry Selection & Header Switching

* **Given:** A user with `roles: ['police', 'owner']` signs in or opens `/` (or opens a deep link such as `/owner` directly).
* **When:** At `/` or `/login`, the user is prompted on `/select-role` to pick `'police'` or `'owner'` and selects `'owner'`, then later switches to `'police'` using the header switcher in `AppHeader.vue`.
* **Then:** On `/owner`, only owner-scoped listeners (`carsRef`, `ownerFinesQuery`) subscribe and only personal vehicles/fines are shown. Switching to `/police` detaches owner-only listeners and mounts police listeners without `permission-denied` errors. Opening `/owner` in a second tab keeps both tabs working independently.

### CUJ 4: Police Self-Enforcement Prevention

* **Given:** A user with `roles: ['police', 'owner']` owns a registered vehicle (or is listed as `transferToOwnerId` on an incoming transfer) and navigates to `/police`.
* **When:** That vehicle, transfer, fine dispute, or a violation report targeting that vehicle's plate is reviewed in the Police UI, or the officer invokes a police Cloud Function targeting that entity.
* **Then:** The Police UI disables enforcement/approval actions on the officer's own car, transfer, dispute, and report modal with an explanatory notice, and every police Cloud Function rejects the operation with `PERMISSION_DENIED` if called directly.

### CUJ 5: Existing User Migration via Fireway

* **Given:** Existing Firestore `users` documents store singular `role` (`'owner'`, `'police'`, or `'agent'`), and incomplete documents may exist without `role`.
* **When:** Dual-read code and updated `SetUserRoleUseCase` deploy first, followed by Fireway `v4` additive backfill (`role` -> `roles`) and later Fireway `v5` unmigrated-document backfill and cleanup.
* **Then:** Valid users receive `roles` (`['owner']`, `['police', 'owner']`, or `['agent', 'owner']`) without locking out active sessions, incomplete documents are skipped without corrupting `roles`, and migrated officers/agents gain access to `/owner` and personal vehicle transfers.

## Technical Plan (Architecture)

### 1. User Schema & Onboarding Hardening

* **User Record Contract:** Replace singular `role` with `roles` (`UserRole[]`), constrained to `['owner']`, `['police', 'owner']`, or `['agent', 'owner']`. Normalize any legacy `role` string consistently at persistence and client-helper boundaries (`'police'` -> `['police', 'owner']`, `'agent'` -> `['agent', 'owner']`, `'owner'` -> `['owner']`) so domain entities, policies, and routing logic depend only on normalized `roles` arrays.
* **Write-Once Onboarding (`SetUserRoleUseCase`):** Execute `setUserRole` inside a database transaction. Reject calls when `users/{uid}` already holds a non-empty `roles` array (`ALREADY_EXISTS`), validate the selected role (`INVALID_ARGUMENT`), persist the mapped `roles` tuple while preserving any existing `createdAt` timestamp on partial docs, and emit an audit log entry.
* **Profile Field Allowlisting (`UpdateUserProfileUseCase` & Entry Point):** Overwrite `uid` from `request.auth.uid` at the entry point so callers cannot spoof another user ID, allow only known string profile fields (`fullName`, `identityNumber`, `birthDate`, `phone`) with in-memory type validation, reject disallowed keys (`roles`, `role`, `createdAt`), and map domain errors cleanly to HTTPS error codes on both user entry points.

### 2. Client Routing, Entry Prompt & Workspace Switching

* **Entry Prompt (`select-role.vue`):** Add a headerless workspace chooser page presented to authenticated multi-role users arriving at `/` or `/login`. Each workspace lives at its own route (`/owner`, `/police`, `/agent`) and `pages/index.vue` renders headerless as a loading screen, preserving active tabs and browser reloads without `sessionStorage`.
* **Route Middleware (`role.global.ts`):** Wait for Firebase Auth hydration before reading user state so cold loads on `/login` do not skip redirects, remove `/login` from the early-return bypass, and enforce deterministic routing:
  * Empty `roles` -> redirect to `/onboarding` (when not already there).
  * Non-empty `roles` visiting `/onboarding` -> redirect single-role users to `/${roles[0]}` and multi-role users to `/select-role`.
  * Single-role user -> restrict dashboard and entry routes to their single workspace route.
  * Multi-role user -> direct `/` and `/login` to `/select-role`, allow `/select-role` and authorized workspace routes, and fall back unauthorized paths to `/select-role`.
* **Header Switcher (`AppHeader.vue`):** Keep `title` and `role` props optional and hide the badge/switcher cleanly whenever `role` is absent. Render an interactive dropdown role switcher only when `roles.length > 1`, keeping a static badge for single-role owners. Disambiguate `roles.owner` locale strings (`"Car Owner"` / `"Propriétaire"` / `"مالك سيارة"`) so `"Car Owner"` is distinct alongside `"Police"` and `"Agent"`.

```text
+--------------------+      roles.length == 0       +---------------+
| Authenticated User | ---------------------------> |  /onboarding  | (write-once setUserRole)
+--------------------+                              +---------------+
         |
         | has roles[]
         v
   +-----------+   roles.length == 1       +---------------+
   |  Route ?  | ------------------------> | /${roles[0]}  | (no header switcher)
   +-----------+                           +---------------+
     |        \
     |         \  valid deep link (/police | /agent | /owner in roles[])
     |          +-------------------------------------------------------+
     | visiting / or /login (roles.length > 1)                          |
     v                                                                  v
+--------------+           user selects workspace          +-------------------------+
| /select-role | ----------------------------------------> | /police | /agent | /owner |
+--------------+                                           +-------------------------+
                                                                    ^        |
                                                                    | switch | (AppHeader.vue)
                                                                    +--------+
```

### 3. Role-Gated Pinia Listeners & Dead-Code Cleanup

* **Workspace-Gated Listeners:** Every role-specific reactive Firestore listener in Pinia stores (`cars`, `fines`, `reports`) must gate on **both** authenticated user capability (`roles` membership) **and** active workspace route metadata (`route.meta.role`), returning `null` otherwise so inactive workspaces tear down listeners immediately. Capture route state at store factory initialization rather than inside reactive getters.
* **Unused Directory Removal:** Delete the unused `ownersQuery` listener, derived owner lists, and unreferenced `UserSelectMenu.vue` component from the user store and UI components instead of migrating them, removing unnecessary full-collection `/users` subscriptions from `/owner`.

### 4. Server Authorization, Firestore Rules & Police Conflict-of-Interest Guards

* **`firestore.rules`:** Introduce a null-safe `hasRole(role)` helper verifying user doc existence plus dual-read support (`role in roles`, falling back to legacy singular `role` until post-`v5` cleanup). Enforce `hasRole(...)` across `/reports`, `/fines`, and `/cars`, keep `/users/{userId}` reads gated on `isSecureRequest()` (which checks `request.auth != null`) and writes disabled, and keep `storage.rules` UID-scoped.
* **Shared Application Policy Helpers:** Provide centralized `assertHasRole` and `assertNotSelfEnforcement` domain helpers that throw `PERMISSION_DENIED` (logging `SELF_ENFORCEMENT_BLOCKED` on conflict-of-interest hits). Migrate all `car`, `report`, `fine`, and `evidence` authorization checks to `roles` membership, keeping `RequestOwnershipTransferUseCase` validating buyer `'owner'` capability and keeping `PayFineUseCase` / `DisputeFineUseCase` authorized via existing `fine.ownerId === actorId` ownership checks. Keep read-only signed URL lookups open to `'police'` ahead of owner fallbacks.
* **Police Mutation Conflict-of-Interest Checks:** Enforce `assertNotSelfEnforcement` (with all reads completed before writes):
  * Car approvals, rejections, deletions, and disputes: block when `ownerId === actorId`.
  * Vehicle transfers: buyers initiate transfers by plate lookup into `transfer_pending_owner`, where only the seller (`car.ownerId`) may accept (advancing to `transfer_pending_police`) or reject (`'owner'` role). Once in `transfer_pending_police`, block police approval or rejection if either seller (`car.ownerId`) or incoming buyer (`car.transferToOwnerId`) matches `actorId`.
  * Report dismissals and fine issuance: resolve **all** matching car documents (including `'rejected'` and `'archived'` vehicles) across every distinct plate involved (`request.plateNumber`, `report.plateNumber`, and `report.originalPlateNumber` when a plate was corrected) so legacy colliding plates or archived officer cars cannot bypass self-enforcement.
* **Police UI Guardrails:** Disable car, deletion, transfer, and dispute actions in the Police UI whenever the acting user owns or is receiving the target entity. In the report modal (`police/index.vue`), which looks up plates on demand via `carsStore.getCarByPlate` and `userStore.fetchUser`, isolate report-level ownership resolved on modal open from the editable fine plate input so editing the plate cannot re-enable **Dismiss Report**, disable **Dismiss Report** on report-level self-ownership, disable **Confirm Fine** on either report-level or looked-up owner self-ownership, and disable both actions while plate lookup is in progress.

```text
Police Action Request (actorId)
   │
   ├─► assertHasRole(actor, 'police') ──(missing)──► PERMISSION_DENIED
   │
   └─► Resolve all conflicted ownerIds (reads before writes):
         • Cars / Deletions / Disputes ──► [car.ownerId | fine.ownerId]
         • Transfers (police stage)    ──► [car.ownerId, car.transferToOwnerId]
         • Dismiss Report / Issue Fine ──► all owners/buyers across matching active, rejected, and archived cars
            │
            └─► actorId in ownerIds? ──(yes)──► Log SELF_ENFORCEMENT_BLOCKED + PERMISSION_DENIED
                                        (no)──► Execute transaction writes
```

### 5. Staged Fireway Migration (`functions/migrations/`)

* **Fireway Contract:** Follow the existing forward-only `migrate({ firestore })` migration contract in `functions/migrations/` using batched cursor pagination.
* **Rollout Sequence:**
  1. Deploy dual-read `firestore.rules`, repository/helper normalization, updated Cloud Functions (`SetUserRoleUseCase` writing `roles`), and updated frontend.
  2. Run `v4__user_roles_array.ts` to backfill `roles` on all valid legacy user docs while preserving singular `role` and skipping docs without a valid role or already holding `roles`.
  3. Run `v5__remove_legacy_user_role.ts` to backfill any remaining valid unmigrated docs and delete legacy `role`.
  4. **Post-`v5` Cleanup:** Once `v5` finishes, deploy code, Firestore rules, and test updates removing legacy `role` dual-read fallbacks.

## Alternatives Considered

### Alternative A: Server-Enforced `activeRole` on `users/{uid}` with `switchActiveRole` Callable

* **Pros:** Enforces active workspace isolation directly inside `firestore.rules` and Cloud Functions rather than only in client routing and listeners.
* **Cons:** Storing a single `activeRole` per user document breaks multi-tab sessions (switching to `'owner'` in Tab B immediately causes `permission-denied` errors on Tab A's `/police` listeners), introduces listener-teardown race conditions during switches, adds Firestore write overhead on every switch, requires a dedicated `switchActiveRole` Cloud Function, and complicates rollback logic. Because any multi-role user can call `switchActiveRole` before any request, `activeRole` does not prevent unauthorized actions any better than checking `roles` membership plus `ownerId !== actorId`.
* **Reason for Rejection:** Client-side route mode provides the same workspace separation with multi-tab support, zero Firestore writes on switch, and simpler server authorization via `roles` membership and conflict-of-interest guards.

### Alternative B: Implicit Simultaneous Owner Capabilities (No Workspace Switcher)

* **Pros:** Requires no `/select-role` prompt, no header switcher in `AppHeader.vue`, and no dual-gating of owner vs. enforcement listeners.
* **Cons:** Mixes personal vehicles, transfers, and personal fines directly into police or agent dashboards, increasing UI clutter and the risk of user confusion between personal actions and enforcement work.
* **Reason for Rejection:** Keeping personal vehicle management and police/agent workflows on separate dashboards avoids mixing contexts.

### Alternative C: Blocking Deep Links on Every New Tab Until Role Selection

* **Pros:** Forces multi-role users opening a new tab or bookmark to confirm whether they want `'owner'` or `'police'`/`'agent'` mode before entering any dashboard.
* **Cons:** Interrupts users opening direct bookmarks or deep links (such as `/police` or `/owner`) even when their account holds that role.
* **Reason for Rejection:** Prompting at `/` and `/login` while honoring valid deep links avoids blocking direct navigation and eliminates cross-tab `sessionStorage` state.

### Alternative D: Blocking Police Read Access to Signed URLs on Own Vehicles or Fines

* **Pros:** Applies conflict-of-interest isolation to read-only evidence and document views (`GetEvidenceUrlsUseCase`, `GetDocumentUrlUseCase`), preventing an officer from inspecting photos on their own cancelled fine or pre-review report.
* **Cons:** Adds plate-to-car lookups inside read paths and causes permission errors when previewing items in police queues.
* **Reason for Rejection:** Self-enforcement checks are applied to all police mutations, keeping read-only signed URL lookups open to `'police'`.

## Risks & Mitigations

* **Open Enforcement Role Selection at Initial Onboarding:** First-time onboarding in `onboarding.vue` allows any newly signed-in user to select `'police'` or `'agent'`. *Mitigation:* Making `setUserRole` write-once prevents existing `'owner'` accounts from escalating later; adding an admin allowlist or invite check is tracked in Future Improvements.
* **`allFinesQuery` Read Scope:** Switching back into `/police` re-subscribes `allFinesQuery`, streaming all `fines` docs. *Mitigation:* Gating `allFinesQuery` to `/police` prevents fine-collection listeners on `/owner` and `/agent`; bounding `allFinesQuery` is tracked in Future Improvements.
* **Rollout Window Between Legacy and New Clients:** Old rules/clients reading `user.role` would fail if `role` is removed before new code is live. *Mitigation:* Dual-read support deploys first, `v4` retains `role`, and `v5` runs unmigrated-document backfill before deleting `role`, followed by post-`v5` fallback removal.

## Future Improvements

* **Pre-authorized enforcement onboarding:** Gate `'police'` and `'agent'` selection in `onboarding.vue` and `SetUserRoleUseCase` behind an admin allowlist or invite code so uninvited Google sign-ins default to `['owner']`.
* **Scoped `/users/{userId}` read policy:** Restrict `/users/{userId}` reads in `firestore.rules` to self, `'police'`, or a minimal public display-name projection rather than allowing broad authenticated reads.
* **`allFinesQuery` pagination:** Add a `limit()` or cursor pagination to `allFinesQuery` in `front/app/stores/fines.ts` to bound reads when switching into `/police`.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

Implementation is divided into four sequential phases.

### Phase 1: Backend Schema, Authorization, Hardening, Dual-Read Rules & Backend Tests

#### Target Files

1. `functions/src/domain/entities/user.entity.ts` (Modify)
   * Replace `role: UserRole` on `User` with `roles: UserRole[]`.
2. `functions/src/domain/repositories/user.repository.ts` (Modify)
   * Update `save(user: Partial<User>, tx?: TransactionContext): Promise<void>` to accept an optional transaction context.
3. `functions/src/domain/repositories/car.repository.ts` (Modify)
   * Add `getAllByPlateNumber(plateNumber: string, tx?: TransactionContext, options?: { includeRejected?: boolean; includeArchived?: boolean }): Promise<Car[]>`.
4. `functions/src/infrastructure/adapters/persistence/FirestoreUserRepository.ts` (Modify)
   * In `getById`, normalize legacy `role` into `roles` consistently: `'police'` -> `['police', 'owner']`, `'agent'` -> `['agent', 'owner']`, `'owner'` -> `['owner']`, otherwise `[]` when `roles` is absent.
   * In `save(user, tx?)`, inspect the existing snapshot first (`tx ? await firestoreTx.get(ref) : await ref.get()`) and only include `createdAt: serverTimestamp()` when `!snap.exists || !snap.data()?.createdAt` before calling `set(..., { merge: true })`.
5. `functions/src/infrastructure/adapters/persistence/FirestoreCarRepository.ts` (Modify)
   * Implement `getAllByPlateNumber(plateNumber, tx?, options?)` querying `plateNumberNormalized` plus legacy doc-ID fallback (`getById(normalized)`), returning all matching cars while filtering out `'rejected'` (unless `options?.includeRejected` is `true`) and `'archived'` (deleted vehicles, unless `options?.includeArchived` is `true`).
6. `functions/src/application/usecases/shared/user-authorization.ts` (Create)
   * Export `assertHasRole(user: User | null | undefined, requiredRole: UserRole, message: string): asserts user is User` and `assertNotSelfEnforcement(actorId: string, ownerIds: Array<string | null | undefined>, context: { targetType: string; targetId: string }): void` (logging `SELF_ENFORCEMENT_BLOCKED` via `firebase-functions/logger` before throwing `DomainError('PERMISSION_DENIED', ...)`).
7. `functions/src/application/usecases/user/set-user-role.ts` (Modify)
   * Update constructor to `(userRepository: UserRepository, transactionRunner: TransactionRunner)`. Inside `transactionRunner.run`, check `existing = await userRepository.getById(uid, tx)`; throw `DomainError('ALREADY_EXISTS', ...)` `if (existing?.roles?.length)`. Replace `new Error('Invalid role')` with `DomainError('INVALID_ARGUMENT', 'Invalid role')`. Map `'owner'` -> `['owner']`, `'police'` -> `['police', 'owner']`, `'agent'` -> `['agent', 'owner']`, save via `userRepository.save(..., tx)`, log `SET_USER_ROLE` via `logger.info`, and return `{ ok: true, roles }`.
8. `functions/src/infrastructure/entry-points/user/set-user-role.ts` (Modify)
   * Pass `transactionRunner` to `SetUserRoleUseCase`, guard `const { role, name, email, phone } = request.data ?? {}`, and handle errors with `mapDomainErrorToHttpsError`.
9. `functions/src/application/usecases/user/update-user-profile.ts` (Modify)
   * Reject any payload key outside `{ uid, fullName, identityNumber, birthDate, phone }` and any defined optional field where `typeof value !== 'string'` with `DomainError('INVALID_ARGUMENT', ...)` before calling `userRepository.update(uid, allowedUpdates)`.
10. `functions/src/infrastructure/entry-points/user/update-user-profile.ts` (Modify)
    * Place `uid: request.auth.uid` after `...(request.data ?? {})` (`{ ...(request.data ?? {}), uid: request.auth.uid }`) and handle errors with `mapDomainErrorToHttpsError`.
11. `functions/src/application/usecases/car/add-car.ts` (Modify)
    * Replace `user.role !== 'owner'` with `assertHasRole(user, 'owner', ...)`.
12. `functions/src/application/usecases/car/check-plate.ts` (Modify)
    * Replace `caller.role !== 'owner'` with `assertHasRole(caller, 'owner', ...)`.
13. `functions/src/application/usecases/car/retry-car.ts` (Modify)
    * Replace `user.role !== 'owner'` with `assertHasRole(user, 'owner', ...)`.
14. `functions/src/application/usecases/car/request-car-deletion.ts` (Modify)
    * Replace `user.role !== 'owner'` with `assertHasRole(user, 'owner', ...)`.
15. `functions/src/application/usecases/car/cancel-car-deletion.ts` (Modify)
    * Replace `user.role !== 'owner'` with `assertHasRole(user, 'owner', ...)`.
16. `functions/src/application/usecases/car/request-ownership-transfer.ts` (Modify)
    * Replace `receiver.role !== 'owner'` with `assertHasRole(receiver, 'owner', ...)` (validating the calling buyer `receiverId`).
17. `functions/src/application/usecases/car/acknowledge-transfer.ts` (Modify)
    * Replace `user.role !== 'owner'` with `assertHasRole(user, 'owner', ...)`.
18. `functions/src/application/usecases/car/approve-car.ts` (Modify)
    * Enforce `assertHasRole(actor, 'police', ...)` and `assertNotSelfEnforcement(actorId, [car.ownerId], { targetType: 'car', targetId: carId })`.
19. `functions/src/application/usecases/car/reject-car.ts` (Modify)
    * Enforce `assertHasRole(actor, 'police', ...)` and `assertNotSelfEnforcement(actorId, [car.ownerId], { targetType: 'car', targetId: carId })`.
20. `functions/src/application/usecases/car/approve-car-deletion.ts` (Modify)
    * Enforce `assertHasRole(actor, 'police', ...)` and `assertNotSelfEnforcement(actorId, [car.ownerId], { targetType: 'car', targetId: carId })`.
21. `functions/src/application/usecases/car/approve-transfer.ts` (Modify)
    * Enforce `assertHasRole(actor, 'police', ...)` and `assertNotSelfEnforcement(actorId, [car.ownerId, car.transferToOwnerId], { targetType: 'car_transfer', targetId: carId })`.
22. `functions/src/application/usecases/car/reject-transfer.ts` (Modify)
    * In `transfer_pending_owner`, enforce `assertHasRole(actor, 'owner', ...)` and `car.ownerId === actorId`. In `transfer_pending_police`, enforce `assertHasRole(actor, 'police', ...)` and `assertNotSelfEnforcement(actorId, [car.ownerId, car.transferToOwnerId], { targetType: 'car_transfer', targetId: carId })`.
23. `functions/src/application/usecases/car/get-document-url.ts` (Modify)
    * Check `caller.roles.includes('police')` first; otherwise check `caller.roles.includes('owner')` with ownership/transfer participant predicates.
24. `functions/src/application/usecases/evidence/get-evidence-urls.ts` (Modify)
    * For `'report'`, check `caller.roles.includes('police')` before `(caller.roles.includes('agent') && report.agentId === callerId)`. For `'fine'`, check `caller.roles.includes('police')` before `(caller.roles.includes('owner') && fine.ownerId === callerId && fine.status !== 'cancelled')`.
25. `functions/src/application/usecases/fine/issue-fine.ts` (Modify)
    * Enforce `assertHasRole(caller, 'police', ...)`. Note `functions/src/infrastructure/entry-points/fine/issue-fine.ts` already passes `carRepository`, and `ownerId` / `car` are existing inputs/lookups in `IssueFineUseCase`.
    * Before `if (!car)` and before `reportRepository.update(...)`, resolve distinct non-empty plates (`plateNumber`, `report.plateNumber`, `report.originalPlateNumber` if present) via `carRepository.getAllByPlateNumber(..., tx, { includeRejected: true, includeArchived: true })` and pass `[ownerId, car?.ownerId, car?.transferToOwnerId, ...matchingPlateCars.flatMap(c => [c.ownerId, c.transferToOwnerId])]` to `assertNotSelfEnforcement(issuedBy, ..., { targetType: 'fine', targetId: reportId })`.
26. `functions/src/application/usecases/fine/resolve-dispute.ts` (Modify)
    * Enforce `assertHasRole(actor, 'police', ...)` and `assertNotSelfEnforcement(actorId, [fine.ownerId], { targetType: 'fine', targetId: fineId })`.
27. `functions/src/application/usecases/report/create-report.ts` & `functions/src/application/usecases/report/update-report-plate.ts` (Modify)
    * Replace `user.role !== 'agent'` / `actor.role !== 'agent'` with `assertHasRole(..., 'agent', ...)`.
28. `functions/src/application/usecases/report/dismiss-report.ts` & `functions/src/infrastructure/entry-points/report/dismiss-report.ts` (Modify)
    * Append `carRepository: CarRepository` as the 5th constructor parameter on `DismissReportUseCase` (wired in `entry-points/report/dismiss-report.ts`). Enforce `assertHasRole(actor, 'police', ...)`. Before `reportRepository.update(...)`, guard falsy `report.plateNumber` (existing test fixtures omit `plateNumber`) and resolve distinct non-empty plates (`report.plateNumber`, `report.originalPlateNumber` if present) via `carRepository.getAllByPlateNumber(..., tx, { includeRejected: true, includeArchived: true })`, passing all matched `ownerId` and `transferToOwnerId` values to `assertNotSelfEnforcement(actorId, ..., { targetType: 'report', targetId: reportId })`.
29. `firestore.rules` (Modify)
    * Add `hasRole(role)` checking `exists(/databases/$(database)/documents/users/$(request.auth.uid))` and `('roles' in getUserData() && getUserData().roles is list && role in getUserData().roles) || ('role' in getUserData() && getUserData().role == role)`. Update `/reports` (`hasRole('police') || hasRole('agent')`), `/fines` (`hasRole('police') || (hasRole('owner') && resource.data.ownerId == request.auth.uid)`), and `/cars` (`hasRole('police') || (hasRole('owner') && resource.data.ownerId == request.auth.uid)`). Keep `/users` read `isSecureRequest()` (`request.auth != null`) and write `false`.
30. `functions/tests/unit/firestore-user-repository.spec.ts` (Create)
    * Mock `FirestoreConnector` to test legacy `role` normalization in `getById` (`'police'` -> `['police', 'owner']`, `'agent'` -> `['agent', 'owner']`, `'owner'` -> `['owner']`) and `createdAt` preservation in `save(user, tx?)` when merging onto an existing partial document vs. creating a new document.
31. `functions/tests/unit/set-user-role.spec.ts` (Create)
    * Test first-time `'owner'`, `'police'`, `'agent'` mapping, `ALREADY_EXISTS` rejection on re-call, and `INVALID_ARGUMENT` on bad role.
32. `functions/tests/unit/update-user-profile.spec.ts` (Create)
    * Test allowed profile updates, `INVALID_ARGUMENT` rejection on disallowed keys (`roles`, `role`, `createdAt`) and non-string field values, and entry-point `uid` overwrite protection (`request.data.uid` ignored).
33. Backend Unit Specs Updated to `roles` & Self-Enforcement:
    * `functions/tests/unit/car-authorization.spec.ts` (Modify) — update user mocks to `roles`, test `['police', 'owner']` owner access + police self-enforcement blocks on `approveCar`/`rejectCar`/`approveCarDeletion`/`approveTransfer`/`rejectTransfer` (`transfer_pending_police` seller & buyer).
    * `functions/tests/unit/car-state-machine.spec.ts` (Modify) — update user mocks to `roles`, verify `transfer_pending_owner` seller rejection remains allowed.
    * `functions/tests/unit/car-deletion-fines.spec.ts` (Modify) — update user mocks to `roles`.
    * `functions/tests/unit/check-plate.spec.ts` (Modify) — update user mocks to `roles`, test `['police', 'owner']` calling `checkPlate`.
    * `functions/tests/unit/get-document-url.spec.ts` (Modify) — update mocks to `roles`, verify police branch precedence for dual-role user.
    * `functions/tests/unit/get-evidence-urls.spec.ts` (Modify) — update mocks to `roles`, verify police/agent precedence.
    * `functions/tests/unit/get-evidence-urls-fine.spec.ts` (Modify) — update mocks to `roles`, verify police reads vs. owner cancelled-fine restrictions.
    * `functions/tests/unit/issue-fine.spec.ts` (Modify) — update mocks to `roles` and `carRepository.getAllByPlateNumber`, test self-enforcement block on `ownerId`, `report.plateNumber`, `report.originalPlateNumber` plate-swap attempts, and colliding/archived officer cars.
    * `functions/tests/unit/resolve-dispute.spec.ts` (Modify) — update mocks to `roles`, test self-enforcement block when `fine.ownerId === actorId`.
    * `functions/tests/unit/create-report.spec.ts` (Modify) — update mocks to `roles`, test `['agent', 'owner']` filing report.
    * `functions/tests/unit/update-report-plate.spec.ts` (Modify) — update mocks to `roles`.
    * `functions/tests/unit/dismiss-report.spec.ts` (Modify) — mock `carRepository.getAllByPlateNumber` on `DismissReportUseCase`, test self-enforcement block on `report.plateNumber`, `report.originalPlateNumber`, `'rejected'`/`'archived'`/colliding officer vehicles, plus allowing unregistered or plate-less fixture reports.
    * `functions/tests/unit/entry-points-auth.spec.ts` (Modify) — add `reportRepository`, `enforcementAuditPort`, `userRepository.save`, `userRepository.update`, and `carRepository.getAllByPlateNumber` to `entry-points/index` `vi.mock`, update `mockUsers` seeds from `role` to `roles`, and verify unauthenticated/mapped error responses on `setUserRole`, `updateUserProfile`, and `dismissReport`.
34. Emulator Rules & Concurrency Specs:
    * `functions/tests/emulator/firestore-rules.spec.ts` (Modify) — seed `roles: [...]` and legacy `role` dual-read cases; verify `['police', 'owner']` and `['agent', 'owner']` access and client write denials on `/users`.
    * `functions/tests/emulator/security-rules.spec.ts` (Modify) — update seeds to `roles` and test multi-role rule coverage.
    * `functions/tests/emulator/transfer-concurrency.spec.ts` (Modify) — update seeds to `roles: [...]` and verify buyer/seller self-approval block.

#### Phase 1 Verification Checkpoint
* Verify `pnpm --dir functions build` exits `0` with no TypeScript errors.
* Verify `pnpm --dir functions lint` exits `0`.
* Verify `pnpm --dir functions test:unit` passes all unit specs in `functions/tests/unit/`.
* Verify `firebase emulators:exec --only firestore,auth,storage "pnpm --dir functions test:emulator"` passes rules and concurrency specs.

---

### Phase 2: Frontend Stores, Routing, UI Components, Locales & Frontend Tests

*Note: `front/app/pages/agent/index.vue`, `front/app/pages/owner/index.vue`, and `front/app/pages/police/index.vue` already set `definePageMeta({ role })` and need no metadata edits.*

#### Target Files

1. `front/app/utils/roles.ts` (Create)
   * Export `UserRole` (`'agent' | 'police' | 'owner'`) and `resolveUserRoles(data: { roles?: unknown; role?: unknown } | null | undefined): UserRole[]`, validating `roles` entries or normalizing legacy `'police'` -> `['police', 'owner']`, `'agent'` -> `['agent', 'owner']`, `'owner'` -> `['owner']`, otherwise `[]` (ordering `'police'`/`'agent'` before `'owner'` when both are present).
2. `front/app/stores/user.ts` (Modify)
   * Replace `role` computed with `roles` (via `resolveUserRoles(userProfile.value)`), `hasRole(r)`, and `isMultiRole`. Delete unused `ownersQuery`, `allOwnersList`, `availableOwners`, and `allOwners`. Keep `setRole` navigating to `/${role}`.
3. `front/app/stores/cars.ts` (Modify)
   * Capture `const route = useRoute()` at store setup top level. Gate `carsRef` on `authStore.currentUser?.uid && userStore.hasRole('owner') && route.meta.role === 'owner'` and `pendingCarsRef` on `authStore.currentUser?.uid && userStore.hasRole('police') && route.meta.role === 'police'`.
4. `front/app/stores/fines.ts` (Modify)
   * Capture `const route = useRoute()` at store setup top level. Gate `ownerFinesQuery` on `authStore.currentUser?.uid && userStore.hasRole('owner') && route.meta.role === 'owner'`, and `allFinesQuery` / `pendingDisputesQuery` on `authStore.currentUser?.uid && userStore.hasRole('police') && route.meta.role === 'police'`.
5. `front/app/stores/reports.ts` (Modify)
   * Capture `const route = useRoute()` at store setup top level. Note `stores/reports.ts` reads `user` from `useCurrentUser()` (`user.value?.uid`) rather than `authStore.currentUser?.uid`. Gate `pendingReportsQuery` on `user.value?.uid && userStore.hasRole('police') && route.meta.role === 'police'`, and `agentReportsQuery` on `user.value?.uid && userStore.hasRole('agent') && route.meta.role === 'agent'`.
6. `front/app/middleware/role.global.ts` (Modify)
   * Replace synchronous `useCurrentUser()` with `const user = await getCurrentUser()` so cold loads on `/login` wait for Firebase Auth hydration, and simplify the early return to `if (!user.value) return`.
   * Resolve `roles = resolveUserRoles(userDoc.data())` and apply:
     * `!roles.length`: `if (to.path !== '/onboarding') return navigateTo('/onboarding')`.
     * `to.path === '/onboarding'` (with `roles.length > 0`): navigate to `/select-role` (`roles.length > 1`) or `/${roles[0]}` (`roles.length === 1`).
     * `roles.length === 1`: redirect any path outside `/${roles[0]}` to `/${roles[0]}`.
     * `roles.length > 1`: redirect `/` or `/login` to `/select-role`; allow `/select-role` and workspace routes matching `roles`; redirect unauthorized paths to `/select-role`.
7. `front/app/pages/index.vue` (Modify)
   * Add `definePageMeta({ layout: false })` so loading screen never mounts `AppHeader.vue` with undefined `route.meta.role`.
8. `front/app/pages/select-role.vue` (Create)
   * Workspace chooser (`definePageMeta({ layout: false })`) displaying cards for each role in `userStore.roles` and navigating to `/${selectedRole}` on click.
9. `front/app/pages/onboarding.vue` (Modify)
   * Add notice explaining that `'police'` and `'agent'` selections include personal `'owner'` access and that initial role selection cannot be changed later.
10. `front/app/components/AppHeader.vue` (Modify)
    * Make `title?: string` and `role?: 'agent' | 'police' | 'owner'` optional, render subtitle with `v-if="title"`, and guard the role badge / switcher with `v-if="role && cfg"`. When `userStore.roles.length > 1`, render a `UDropdownMenu` switcher (matching `front/app/components/molecules/LanguageMenu.vue`) navigating via ``navigateTo(`/${targetRole}`)``; keep the non-interactive badge when `roles.length === 1`.
11. `front/app/components/molecules/UserSelectMenu.vue` (Delete)
    * Remove dead component unreferenced anywhere in `front/app/` or `front/tests/`.
12. `front/app/pages/police/index.vue`, `front/app/components/organisms/PoliceCarsTab.vue`, & `front/app/components/organisms/PoliceCarReviewModal.vue` (Modify)
    * In `PoliceCarsTab.vue` and `PoliceCarReviewModal.vue`, pass/compute `isSelfOwned(car)` (`car.ownerId === authStore.currentUser?.uid || car.transferToOwnerId === authStore.currentUser?.uid`) to disable inline and modal Approve/Reject/Delete/Transfer buttons with a badge notice.
    * In `front/app/pages/police/index.vue`, instantiate `useAuthStore()`, disable dispute-resolution actions when `selectedDispute.ownerId === authStore.currentUser?.uid`, resolve `isReportSelfOwned` separately inside `openReport(report)` from `report.plateNumber` and `report.originalPlateNumber` (if present) via on-demand `carsStore.getCarByPlate` (which covers non-`rejected`/non-`archived` cars, leaving rare `'rejected'`/`'archived'`/colliding cases to backend enforcement), disable **Dismiss Report** whenever `isReportSelfOwned || fineForm.searching`, and disable **Confirm Fine** whenever `isReportSelfOwned || fineForm.selectedOwner?.id === authStore.currentUser?.uid || fineForm.searching`.
13. `front/i18n/locales/en.json`, `front/i18n/locales/fr.json`, `front/i18n/locales/ar.json` (Modify)
    * Update `roles.owner` to `"Car Owner"` / `"Propriétaire"` / `"مالك سيارة"` (disambiguated from `"Police"` and `"Agent"` in the switcher); add `select_role.title`, `select_role.subtitle`, `header.switch_role`, `onboarding.dual_role_notice`, and `police.self_enforcement_notice` across all three locales.
14. `front/tests/stores-gating.spec.ts` (Modify)
    * Mock `useRoute`, `useRouter()`, `useCurrentUser`, `useDocument()`, `doc()`, and `resolveUserRoles` for Vitest `environment: 'node'`, and test dual gating (`userStore.roles` + `route.meta.role`) across `cars`, `fines`, and `reports` stores plus `userStore` `roles`/`hasRole`/`isMultiRole`.
15. `front/tests/role-middleware.spec.ts` (Create)
    * Stub `globalThis` Nuxt auto-imports (`defineNuxtRouteMiddleware`, `navigateTo`, `resolveUserRoles`), mock `vuefire` (`getCurrentUser`, `useFirestore`) and `firebase/firestore` (`doc`, `getDoc`), and test `/onboarding` redirect (including loop guard), onboarded redirect away from `/onboarding`, cold `/login` reload redirect, single-role lock to `/${roles[0]}`, multi-role `/` & `/login` -> `/select-role`, direct deep-link access, and unauthorized dashboard redirect to `/select-role`.

#### Phase 2 Verification Checkpoint
* Verify `pnpm --dir front test` passes all Vitest specs (including `stores-gating.spec.ts` and `role-middleware.spec.ts`).
* Verify `pnpm --dir front lint` exits `0`.
* Verify `pnpm --dir front build` completes `nuxt build` with zero errors.

---

### Phase 3: Additive Fireway Backfill Migration (`v4`)

#### Target Files

1. `functions/migrations/v4__user_roles_array.ts` (Create)
   * Export `async function migrate({ firestore }: MigrateOptions)` using `MAX_BATCH_OPS = 450` and cursor pagination (`orderBy(FieldPath.documentId())` + `startAfter`). Skip docs that already have a non-empty `roles` array or lack a valid `role` (`'agent' | 'police' | 'owner'`). Write `roles` (`['owner']`, `['police', 'owner']`, `['agent', 'owner']`) while retaining legacy `role`. Log `{ migrated, skipped, errors }`.
2. `functions/tests/emulator/migrations.spec.ts` (Modify)
   * Add `v4` tests covering `'owner'` / `'police'` / `'agent'` backfill, skipping incomplete docs without `role`, and idempotent re-run on already-migrated docs.

#### Phase 3 Verification Checkpoint
* Deploy Phase 1 + Phase 2 code/rules first, then execute `pnpm --dir functions migrate` (and verify `firebase emulators:exec --only firestore,auth,storage "pnpm --dir functions test:emulator"` passes `migrations.spec.ts`).

---

### Phase 4: Legacy `role` Cleanup Migration (`v5`) & Post-`v5` Fallback Removal

#### Step 4A: Execute `v5` Migration

1. `functions/migrations/v5__remove_legacy_user_role.ts` (Create)
   * Export `async function migrate({ firestore }: MigrateOptions)` with `MAX_BATCH_OPS = 450` and cursor pagination: run unmigrated-document backfill of `roles` for any doc still carrying a valid `role` and missing `roles`, then delete `role` via `FieldValue.delete()`.
2. `functions/tests/emulator/migrations.spec.ts` (Modify)
   * Add `v5` tests verifying unmigrated-document backfill before `role` deletion and confirming idempotent behavior when `role` is already absent.

* **Checkpoint (Step 4A):** Run `pnpm --dir functions migrate` (applying `v5`) and confirm `migrations.spec.ts` passes before deploying Step 4B fallback removals.

#### Step 4B: Post-`v5` Fallback Removal

1. `functions/src/infrastructure/adapters/persistence/FirestoreUserRepository.ts`, `firestore.rules`, `front/app/utils/roles.ts` (Modify)
   * Remove legacy singular `role` dual-read fallback branches once `v5` completes across production.
2. `functions/tests/unit/firestore-user-repository.spec.ts`, `functions/tests/emulator/firestore-rules.spec.ts` (Modify)
   * Remove legacy-`role` dual-read test cases matching fallback removal.

* **Checkpoint (Step 4B):** Deploy updated `firestore.rules`, functions, and frontend, and verify `pnpm --dir functions test:unit`, `pnpm --dir front test`, and `firebase emulators:exec --only firestore,auth,storage "pnpm --dir functions test:emulator"` all pass.

--------------------------------------------------------------------------------

<!-- Provenance: Initial structural drafting and Goldfish review remediation via the Elephant-Goldfish Model (EGM). -->

*Drafted with the Elephant-Goldfish Model (EGM)*
