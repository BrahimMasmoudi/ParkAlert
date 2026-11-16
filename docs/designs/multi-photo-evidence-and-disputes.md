# ParkAlert Multi-Photo Evidence, Plate Verification, and Owner Dispute Workflow

*   **Author:** BrahimMasmoudi
*   **Status:** Approved
*   **Date:** 2026-11-16

--------------------------------------------------------------------------------

## Overview

ParkAlert currently lets parking enforcement agents submit a violation report with at most one skippable photo, provides neither post-submission nor police-review plate editing, and gives fined vehicle owners neither violation photo access nor an in-app dispute path.

This phased design upgrades the enforcement lifecycle across two releases:

*   **Release 1 (Evidence Capture, Signed Report Viewing, & Plate Verification):** Require 2 to 3 raster photos per new violation report (with an explicit reminder on the `'plate'` slot to capture the license plate), re-encode and shrink photos on the agent's device before upload, lock `/reports/` Storage reads behind 5-minute signed URLs for police and submitting agents, let agents edit the plate on `pending` reports, and let police officers inspect all photos side-by-side with an editable plate field (plus dismiss invalid reports).
*   **Release 2 (Owner Evidence Visibility & Fine Disputes):** Extend signed-URL evidence viewing to fined vehicle owners, let owners submit a single text dispute on `unpaid` fines without lifting vehicle transfer or deletion locks, and add a police dispute queue to mark invalid fines as `cancelled` or dismiss unfounded disputes.

## The Problem

1.  **Insufficient Proof & Misattributed Plates:** With a single skippable photo today, a report may omit either the parking context (no-parking sign, curb, blocking position) or a legible close-up of the license plate. If an agent mistypes a character during manual plate entry, neither the agent (after submitting) nor the reviewing police officer can spot and fix the typo against a plate photo.
2.  **Video Is Too Heavy for Field Operations:** Recording video proof adds multi-megabyte uploads over slow mobile networks, increases cloud storage and bandwidth costs, and forces police officers to scrub through clips instead of checking still photos quickly.
3.  **No Owner Proof or Dispute Mechanism:** Vehicle owners receive fines without seeing violation photos and have no in-app way to flag a wrong-plate fine. At the same time, giving owners direct access to permanent Storage token URLs or letting a dispute bypass unpaid-fine transfer checks creates privacy and fraud risks.

## Goals

### Release 1: Multi-Photo Capture & Pre-Fine Verification

*   Require 2 photos (Photo 1: parking violation area; Photo 2: license plate with an explicit UI reminder) and allow 1 optional third photo on all new violation reports; remove the photo-skip option.
*   Re-encode and shrink every uploaded photo on the agent's phone to target under 800 KB per photo (enforcing a 1.5 MB per-photo Storage limit) and restrict Storage rules to web-renderable raster formats (`jpeg`, `png`, `webp`) so mobile uploads stay small and Storage rules block uploads declaring `image/svg+xml`.
*   Lock `/reports/` Storage reads behind role-checked 5-minute signed URLs for police and submitting agents.
*   Allow agents to verify and edit the license plate before submitting (with the `'plate'` photo visible) and on submitted reports while status remains `pending`.
*   Allow police officers to view all attached photos alongside an editable plate input when issuing a fine, preserve the earliest original plate in audit metadata if changed, and dismiss reports with illegible photos or unregistered plates.
*   Keep every historical report (0–1 photo via legacy `photoUrl`) readable in police and agent views.

### Release 2: Owner Evidence Access & Dispute Resolution

*   Allow vehicle owners to view the evidence photos attached to their fines through 5-minute role-checked signed URLs, revoking access automatically when a fine is marked `cancelled`.
*   Allow vehicle owners to submit up to 1 text dispute explanation per `unpaid` fine while keeping vehicle ownership transfer and car deletion blocked on every `unpaid` (including pending-dispute) fine.
*   Provide a police dispute queue to review the owner's explanation alongside the evidence photos, either marking invalid fines `cancelled` (without hard deletions, closing the linked report as `resolved`) or rejecting unfounded disputes so the fine remains `unpaid` and payable.

## Non-Goals

*   **Video Evidence:** Capturing, uploading, or playing video clips is excluded.
*   **Automatic Plate Recognition (OCR):** Reading license plates automatically from images is excluded; plate entry and verification remain manual.
*   **Owner Counter-Photos & Chat Threads:** Owners submit a single text reason per fine; uploading counter-evidence photos or running multi-message threads with police is excluded.
*   **Disputes or Refunds on Paid Fines:** Only `unpaid` fines can be disputed. Paid-fine appeals and payment refunds are out of scope.
*   **Hard-Deleting or Auto-Reassigning Fines:** Invalid fines are marked `cancelled` rather than hard-deleted from Firestore, and cancelling a fine does not automatically issue a new fine to another owner.

## Critical User Journeys (CUJs)

### CUJ 1: Agent Captures Multi-Photo Violation Report (Release 1)

*   **Given:** An authenticated parking enforcement agent opens the 3-step report creation wizard (Step 1: Evidence, Step 2: Location, Step 3: Plate) on a mobile device.
*   **When:** The agent captures Photo 1 (`'context'` — violation area), sees the reminder on Photo 2 (`'plate'`) and captures the license plate, optionally adds Photo 3 (`'extra'`), enters GPS/address, enters the plate number while checking the Photo 2 preview, and submits.
*   **Then:** The app shrinks and re-encodes the 2–3 photos on-device, uploads them to private Storage, creates a `pending` report with 2–3 verified photo paths, and blocks submission if fewer than 2 photos are attached.

### CUJ 2: Agent Corrects Plate on Pending Report (Release 1)

*   **Given:** An agent submitted a report that is still in `pending` status and notices a typo in the typed plate number.
*   **When:** The agent opens their sent-reports list, inspects the signed-URL photos, edits the plate number, and saves.
*   **Then:** The report's plate number updates in place if the report is still `pending`; if police already processed or dismissed the report, the edit is rejected with an error explaining the report is no longer `pending`.

### CUJ 3: Police Verifies Photos, Corrects Plate, or Dismisses Report (Release 1)

*   **Given:** A police officer opens a `pending` report in the Police Control Panel.
*   **When:** The officer reviews all 2–3 signed-URL photos next to the editable plate field—either leaving the plate as-is, correcting a mistyped character to re-lookup the registered vehicle owner and issue a fine, or dismissing the report with a reason if the photos are unreadable or the plate is unregistered.
*   **Then:** Issuing a fine snapshots the evidence photo paths onto the fine, preserves the earliest original plate in audit metadata, and marks the report `investigated` (preventing duplicate fines); dismissing marks the report `resolved` without issuing a fine.

### CUJ 4: Owner Views Evidence & Disputes an Unpaid Fine (Release 2)

*   **Given:** A vehicle owner opens an `unpaid` fine in the Owner Dashboard.
*   **When:** The owner opens the fine's evidence viewer to inspect the 2–3 signed-URL photos, sees the car or plate does not match, and submits a dispute with a written explanation.
*   **Then:** The fine records a `pending` dispute without removing the unpaid-fine lock on vehicle transfers and car deletions, hides the Pay action while the dispute is pending, and displays the pending dispute status instead of the dispute button.

### CUJ 5: Police Reviews Dispute and Marks Fine Cancelled or Dismisses Dispute (Release 2)

*   **Given:** A police officer opens the Disputes tab in the Police Control Panel and selects a fine with a `pending` dispute.
*   **When:** The officer inspects the owner's explanation alongside the evidence photos and plate history, then chooses either **Cancel Fine** (with a reason) or **Dismiss Dispute** (with a reason).
*   **Then:** Cancelling marks the fine `cancelled` and the dispute `accepted`, transitions the linked report to `resolved`, revokes owner signed-URL evidence access, and preserves the record in audit history; dismissing marks the dispute `rejected` so the fine remains `unpaid` and payable by the owner.

## Technical Plan (Architecture)

The design extends ParkAlert's Firebase hexagonal backend (`functions/src`) and Nuxt 4 Atomic Design frontend (`front/app`) in two sequential releases while establishing shared schemas and security boundaries in Release 1.

### 1. End-to-End Flow

```text
RELEASE 1: Capture, Signed Report Viewing & Pre-Fine Verification
  [Agent Mobile UI]
     |-- 1. Re-encode & shrink 2..3 photos on-device to JPEG
     |-- 2. Upload to private Storage: reports/{agentId}/...
     |-- 3. Call createReport(photos[2..3], plate, location, address)
     v
  [Firestore: reports/{id} (status: 'pending')]
     |-- Agent can call updatePendingReportPlate while status == 'pending'
     v
  [Police Panel: Unified Review & Issue Modal]
     |-- Loads 5-minute signed URLs via getEvidenceUrls('report', reportId)
     |-- Views 'context', 'plate', and optional 'extra' photos next to editable plate
     |-- Option A: Edit plate -> re-lookup Car by normalized plate -> issueFine()
     |             (snapshots evidencePhotos onto Fine, logs change, report -> 'investigated')
     '-- Option B: Illegible / unregistered -> dismissReport(reason) (report -> 'resolved')

RELEASE 2: Owner Evidence Access & Fine Disputes
  [Owner Dashboard: Fines Tab]
     |-- Loads 5-minute signed URLs via getEvidenceUrls('fine', fineId)
     |-- Submits disputeFine(fineId, reason) on 'unpaid' fine (disputeStatus -> 'pending')
     v
  [Transfer / Deletion Guard: hasUnpaidFines]
     |-- Blocks car ownership transfers & deletions while fine.status == 'unpaid'
     v
  [Police Panel: Disputes Tab]
     |-- Queries fines where disputeStatus == 'pending'
     |-- Option A: resolveDispute('cancel_fine', reason)
     |             -> fine.status = 'cancelled', disputeStatus = 'accepted',
     |                report.status = 'resolved', owner URL access stops
     '-- Option B: resolveDispute('dismiss_dispute', reason)
                   -> fine.disputeStatus = 'rejected', fine stays 'unpaid' & payable
```

### 2. Data Model & State Machines

*   **`Report` (Release 1):**
    *   Add `photos` storing 2–3 typed photo references (`{ path, slot }` with slot values `'context'`, `'plate'`, and optional `'extra'`).
    *   Keep legacy `photoUrl` optional on read so historical reports with 0–1 photo still render.
    *   Add plate-edit and dismissal metadata (`originalPlateNumber`, `plateCorrectedBy`, `plateCorrectedAt`, `resolutionReason`, `resolvedBy`, `resolvedAt`).
    *   `ReportStatus` remains `'pending' | 'investigated' | 'resolved'`, using `'resolved'` both when a pending report is dismissed pre-fine and when a fine is cancelled after dispute.
*   **`Fine` (Release 1 schema additions; Release 2 dispute workflow):**
    *   Keep existing `reportId` linkage to the originating report.
    *   Expand `FineStatus` to `'unpaid' | 'paid' | 'cancelled'` (never hard-deleting fines).
    *   Snapshot `evidencePhotos` onto `Fine` during issuance (`report.photos ?? []`) so owner evidence authorization never reads `/reports` and pre-Release-1 pending reports without `photos` yield empty evidence rather than leaking legacy static URLs.
    *   Add plate-correction metadata (`originalPlateNumber`, `plateCorrectedBy`, `plateCorrectedAt`), writing `originalPlateNumber` only once (preserving the earliest value across sequential agent and police edits).
    *   Add independent dispute and resolution fields (mirroring existing rejection fields on `Car`) so opening a dispute keeps `Fine.status` as `'unpaid'`: `disputeStatus` (`'none' | 'pending' | 'accepted' | 'rejected'`), `disputeReason`, `disputedAt`, `resolutionReason`, `resolvedBy`, and `resolvedAt`.
*   **`enforcement_audit_logs` Collection (Release 1 & 2):**
    *   Append-only collection (mirroring `car_audit_logs`, the existing audit collection for vehicle lifecycle changes) written transactionally via a shared enforcement audit helper using unified action names: `UPDATE_REPORT_PLATE`, `DISMISS_REPORT`, `ISSUE_FINE`, `DISPUTE_FINE`, `DISMISS_DISPUTE`, `CANCEL_FINE`, and `PAY_FINE`.

### 3. Storage, Security Rules, & Signed-URL Media Access

*   **On-Device Compression & Privacy (Release 1):**
    *   Unconditionally re-encode every accepted photo (`jpeg`, `png`, `webp`) into `image/jpeg` on the agent's device before upload so mobile transfers stay under the 1.5 MB Storage limit and every uploaded image is stripped of camera EXIF metadata.
    *   Reject unsupported or undecodable formats (such as `HEIC`/`HEIF` on non-Safari browsers or `image/svg+xml`) in the UI with a prompt asking for JPEG, PNG, or WebP.
    *   Upload concurrently to unique agent-scoped Storage paths; pre-submit retakes and removals happen in local memory before upload begins.
*   **`storage.rules` (Release 1):**
    *   Disable direct client reads on `/reports/{agentId}/{fileName}` (matching existing private vehicle-document prefixes `carteGrise` for registration cards and `transfers` for ownership documents).
    *   Permit object creation (`create` only, up to 1.5 MB, restricted to `jpeg`, `png`, and `webp`) while disallowing both updates and deletes so uploaded report evidence stays immutable once written.
*   **`firestore.rules` & `firestore.indexes.json` (Release 1 & 2):**
    *   Keep `/reports/{reportId}` read restricted to `police` and `agent`; keep `/fines/{fineId}` read restricted to `police` and owning `owner`; lock `/enforcement_audit_logs/{logId}` to server-only Admin SDK access.
    *   Add a composite index on `fines` for `(disputeStatus, disputedAt)` to back the Release 2 Police Disputes queue.
*   **Signed-URL Evidence Service (`getEvidenceUrls`) (Release 1 for `'report'`, Release 2 for `'fine'`):**
    *   Reuse the existing signed-URL storage adapter, which issues 5-minute (300 s) V4 signed URLs in production and inline base64 `data:` URIs in local Storage Emulator mode (keeping compressed 3-photo responses well under Cloud Functions' 10 MB callable limit).
    *   Authorize `'report'` requests for `'police'` or the submitting `'agent'`, and authorize `'fine'` requests when the caller is `'police'`, or when the caller is the owning `'owner'` and `fine.status !== 'cancelled'`.
    *   Return legacy HTTP/HTTPS `photoUrl` entries for authorized Release 1 `'report'` views, return an empty list for historical fines lacking `evidencePhotos`, and isolate per-slot missing-object errors so one bad file does not hide remaining photos.

### 4. Backend Use Cases & Entry Points (Hexagonal Layer)

*   **Release 1:**
    *   **Report creation (`createReport`):** Enforce 2–3 distinct raster Storage paths scoped to the caller (`'context'` and `'plate'` required, at most one `'extra'`), verify each blob exists with raster metadata in Storage, validate French plate format (uppercased and stripped of spaces/hyphens via `normalizePlate`) and location/address presence, fix the entry-point object-spread order so client payloads cannot overwrite the authenticated `agentId`, and map errors via `DomainError`.
    *   **Pending report plate edit (`updatePendingReportPlate`):** Transactional callable for the submitting agent while `report.status === 'pending'`, validating plate format and logging `UPDATE_REPORT_PLATE`.
    *   **Fine issuance (`issueFine`):** Guard `report.status === 'pending'` to prevent duplicate fines, reject stale submissions if a concurrent agent edit changed the report's plate since the officer loaded it, align eligible vehicle status checks (excluding `archived` and `rejected` while keeping `active`, `activation_pending`, `deletion_requested`, and `transfer_pending_*` finable across matching records without `.limit(1)`), carry the earliest `originalPlateNumber` onto `Fine` (and mirror officer plate edits onto `Report`), snapshot `evidencePhotos`, and log `ISSUE_FINE`.
    *   **Report dismissal (`dismissReport`):** Police-only transactional callable transitioning a `pending` report to `resolved` with a validated reason when photos are unreadable or the vehicle is unregistered.
    *   **Report signed URLs (`getEvidenceUrls`, `'report'` scope):** Serves signed URLs for Release 1 Police and Agent report viewing.
*   **Release 2:**
    *   **Fine signed URLs (`getEvidenceUrls`, `'fine'` scope):** Extends evidence access to vehicle owners on non-cancelled fines.
    *   **Fine dispute (`disputeFine`):** Owner-only transactional callable on `unpaid` fines where `disputeStatus` is `'none'` or unset (historical fines without the field), recording a validated text explanation and setting `disputeStatus = 'pending'`.
    *   **Dispute resolution (`resolveDispute`):** Police-only transactional callable on pending disputes to either mark the fine `cancelled` and `disputeStatus = 'accepted'` (closing the linked report as `resolved`) or reject the dispute (`disputeStatus = 'rejected'`, returning the fine to payable state).
    *   **Fine payment & car-deletion locks (`payFine`, `requestCarDeletion`, `approveCarDeletion`):** Run payment inside a transaction (deriving `userId` from auth context rather than client payload), reject payment on `cancelled` or pending-dispute fines, log `PAY_FINE`, and enforce `hasUnpaidFines` in both car-deletion request and approval workflows.

### 5. Frontend Components & Stores (`front/app`)

*   **Release 1:**
    *   Report creation modal: Replace the existing single skippable photo input with 3 structured slots (area context, license plate with reminder, optional extra angle), add Back navigation on Steps 2–3, display the `'plate'` photo preview on the plate-entry step, and re-encode each photo eagerly when selected.
    *   Agent dashboard: Render the agent's submitted reports sorted newest-first with a plate-edit modal displaying signed-URL photos for `pending` reports (including an error retry button if 5-minute signed URLs expire).
    *   Car lookup store fix: Query by normalized plate across matching records (with legacy document-ID fallback), filter out `archived` and `rejected` vehicles in client code, and add the stale-plate check parameter to the fine issuance store call.
    *   Police control panel: Unify the separate photo preview modal and fine issuance modal into one review-and-issue modal showing all signed-URL photos (with an expired-URL refresh action) beside an editable plate field that triggers owner lookup after typing pauses or on button click, add a dedicated report dismissal modal, and include Release 1 `en`/`fr`/`ar` translations.
*   **Release 2:**
    *   Owner fines UI: Extend the shared document viewer composable for multi-photo signed-URL viewing (with an image-error refresh action), add a Dispute modal on `unpaid` fines, hide `Pay` while `disputeStatus === 'pending'` (keeping `Pay` enabled for `unpaid` fines when `disputeStatus` is `'none'` or `'rejected'`), display `cancelled` fines in a dedicated `Cancelled` section, show a legacy empty-evidence notice inside the evidence modal when clicked, and localize dates.
    *   Police disputes & audit UI: Add the Disputes tab (backed by the indexed pending-disputes query) and Cancel/Dismiss action modals, display neutral `cancelled` badges in `PoliceAuditTab` (the police fine-history audit table), and add Release 2 `en`/`fr`/`ar` translations.

## Alternatives Considered

### Alternative A: Video Capture as Primary Violation Proof

*   **Pros:** Captures continuous context around the vehicle, nearby signs, and whether a driver is inside or idling.
*   **Cons:** High upload sizes (20–50 MB per clip) over mobile networks, higher Firebase Storage and egress costs, and slower officer review scrubbing.
*   **Reason for Rejection:** Heavy mobile upload bandwidth, cloud storage cost, and slow officer review scrubbing make 2–3 compressed still photos a more practical proof format.

### Alternative B: Automatic License Plate Recognition (OCR)

*   **Pros:** Reduces manual typing errors by reading the plate directly from the `'plate'` photo.
*   **Cons:** Cloud OCR (such as Cloud Vision or Gemini APIs) adds per-image API billing and Blaze-plan usage, while browser-side OCR adds a multi-megabyte model download and lower accuracy on angled or dirty plates.
*   **Reason for Rejection:** Out of scope for this iteration; manual entry paired with a mandatory plate photo reminder and agent/police editing avoids extra API cost and client complexity.

### Alternative C: Direct `getDownloadURL` Snapshots Instead of Signed URLs

*   **Pros:** Requires zero new Cloud Functions (`getEvidenceUrls`) and keeps client rendering as direct `<img :src>` URLs.
*   **Cons:** Relies on `storage.rules` allowing any signed-in user to read `/reports/{agentId}/{fileName}` (`isSecureRequest()` checking `request.auth != null`) and persists unrevoked Firebase download tokens even after a misattributed fine is cancelled.
*   **Reason for Rejection:** Static download tokens leave third-party vehicle photos exposed after cancellation, whereas short-lived signed URLs enforce live authorization and revoke access on cancellation.

### Alternative D: Separate `disputes` Collection and Messaging Thread

*   **Pros:** Supports multi-turn owner-police messaging, counter-photo attachments, and multiple appeals per fine without growing the `Fine` document.
*   **Cons:** Requires a new Firestore collection, extra security rules, cross-collection joins, and additional UI screens for single-reason disputes.
*   **Reason for Rejection:** Inline dispute fields on `Fine` (mirroring existing rejection fields on `Car`) cover one-step text disputes with less schema and rule complexity; can be extracted later if multi-round appeals are ever needed.

### Alternative E: Hard-Deleting Invalid Fines and Reopening Reports to `pending`

*   **Pros:** Removes invalid fine records cleanly from active lists and allows immediate re-issuance from the same report.
*   **Cons:** Hard deletion erases financial and audit records in `PoliceAuditTab` (the police fine-history audit table), strands `report.status` in `'investigated'`, and prevents tracking misattribution error rates. Reopening cancelled-dispute reports automatically to `'pending'` also risks unintended re-fining loops.
*   **Reason for Rejection:** Marking invalid fines `cancelled` preserves audit history, and closing the linked `Report` as `'resolved'` avoids unintended re-fining workflows.

## Non-Functional Requirements

*   **Security & Privacy:** Private Storage (`allow read: if false`, `allow create` only with `allow update, delete: if false;`) with 5-minute V4 signed URLs prevents unauthorized access, prevents post-submission photo tampering, and revokes owner evidence reads when a fine is marked `cancelled`. Raster-only `storage.rules` (`jpeg`, `png`, `webp`) blocks uploads declaring `image/svg+xml`, and unconditional client re-encoding strips camera EXIF metadata.
*   **Performance & Storage Budget:** On-device image compression targets under 800 KB per photo (under ~2.4 MB binary / ~3.2 MB base64 for 3 photos in emulator mode, staying under Cloud Functions' 10 MB callable response limit) compared to up to 30 MB raw uploads. Plate legibility must be checked on sample compressed captures during Release 1 verification.
*   **Backward Compatibility & Rollout:** Historical `reports` (`photoUrl` with 0–1 photo) and historical `fines` remain readable via dual-read converters and `getEvidenceUrls` legacy handling (`[]` for pre-feature fines); no destructive backfill is required before deploying Release 1.
*   **Observability:** Emit structured `firebase-functions/logger` events (`reportId`, `fineId`, `actorId`, `action`, `photoCount`, `plateCorrected`) across all report and fine use cases alongside `enforcement_audit_logs` records.

## Risks & Mitigations

*   **Abandoned Draft Uploads in Storage:** Mobile connectivity drops between photo upload and `createReport` completion can leave unreferenced blobs when client deletes are disabled. *Mitigation:* Pre-submit photo retakes stay in local browser memory before upload begins; if mid-upload drops accumulate blobs later, add a GCS bucket lifecycle rule on unlinked prefixes out-of-band without granting agents delete access.
*   **Non-Safari `HEIC`/`HEIF` Decode Failure:** Chromium/Android browsers cannot decode `HEIC` in `createImageBitmap` or display raw `HEIC` in `<img>`. *Mitigation:* Narrow `storage.rules` to `^image/(jpeg|png|webp)$` and surface an explicit UI message asking the user for JPEG, PNG, or WebP when decoding fails.
*   **Single Missing Storage Object Fails Batch Signed URLs:** `StorageSignedUrlAdapter` throws `NOT_FOUND` if any single path is missing. *Mitigation:* Resolve each slot independently in `GetEvidenceUrlsUseCase` so remaining photos still render, and verify Storage blob existence inside `CreateReportUseCase` before saving `pending` reports.
*   **Signed-URL Expiry During Open Review or Dispute Modal:** If a police officer or owner leaves a modal open past 5 minutes, image loads fail with `403`. *Mitigation:* Attach an image-error handler in the evidence viewer that surfaces a one-click "Refresh Photos" action re-calling `getEvidenceUrls`.
*   **Legacy `photoUrl` Token Persistence:** Historical reports created prior to Release 1 hold static `getDownloadURL` tokens that disabling Storage reads does not revoke. *Mitigation:* Restrict legacy `photoUrl` returns inside `getEvidenceUrls` to authorized Release 1 `'report'` callers (`police`/`agent`) and return `[]` for fines lacking `evidencePhotos`.
*   **Concurrent Agent Edit vs. Police Fine Issuance:** If an agent edits a `pending` report's plate while police are reviewing it, police could issue a fine on the stale plate. *Mitigation:* Pass the plate originally loaded by the officer into `IssueFineUseCase` and reject stale submissions with `failed-precondition`.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

Implementation is partitioned into **four sequential phases** across Release 1 and Release 2.

### Phase 1 — Release 1 Backend, Security Rules, & Shared Contracts

#### 1. `storage.rules` (Modify — Release 1)
*   **Type / Scope:** Firebase Storage Security Rules
*   **Proposed Changes:**
    *   Update `match /reports/{agentId}/{fileName}` to `allow read: if false;`.
    *   Replace `allow write` with `allow create: if isSecureRequest() && request.auth.uid == agentId && request.resource.size < 1572864 && request.resource.contentType.matches('^image/(jpeg|png|webp)$');` (1.5 MB cap, raster-only MIME check).
    *   Explicitly add `allow update, delete: if false;` so uploaded report photos cannot be modified or deleted by clients after creation.
*   **Rationale:** Prevents unauthorized cross-user reads and post-submission photo tampering, blocks declared `image/svg+xml` and undecodable `heic` uploads, and aligns with private Storage immutability.

#### 2. `firestore.rules` (Modify — Release 1)
*   **Type / Scope:** Cloud Firestore Security Rules
*   **Proposed Changes:**
    *   Keep `/reports/{reportId}` read restricted to `police` and `agent` and `/fines/{fineId}` read restricted to `police` and `owner` (`resource.data.ownerId == request.auth.uid`).
    *   Add `match /enforcement_audit_logs/{logId} { allow read, write: if false; }`.
*   **Rationale:** Protects report privacy from vehicle owners while locking audit logs to Admin SDK transactions.

#### 3. `functions/src/domain/entities/report.entity.ts` (Modify — Release 1)
*   **Type / Scope:** Backend Domain Entity
*   **Proposed Changes:**
    *   Export `ReportPhotoSlot = 'context' | 'plate' | 'extra'` and `ReportPhoto = { path: string; slot: ReportPhotoSlot }`.
    *   Export `EnforcementAuditAction = 'UPDATE_REPORT_PLATE' | 'DISMISS_REPORT' | 'ISSUE_FINE' | 'DISPUTE_FINE' | 'DISMISS_DISPUTE' | 'CANCEL_FINE' | 'PAY_FINE'` and `EnforcementAuditLog = { id?: string; targetType: 'report' | 'fine'; targetId: string; actorId: string; action: EnforcementAuditAction; originalPlate?: string; issuedPlate?: string; reason?: string; timestamp: Date | any }`.
    *   Extend `Report` with `photos?: ReportPhoto[]`, `originalPlateNumber?: string`, `plateCorrectedBy?: string`, `plateCorrectedAt?: Date | any`, `resolutionReason?: string`, `resolvedBy?: string`, and `resolvedAt?: Date | any`, keeping `photoUrl?: string` optional.
*   **Rationale:** Defines self-describing photo slots, unified audit log contracts, and compatibility with legacy reports.

#### 4. `functions/src/domain/entities/fine.entity.ts` (Modify — Release 1 & 2)
*   **Type / Scope:** Backend Domain Entity
*   **Proposed Changes:**
    *   Keep `reportId: string`.
    *   Release 1: Add `DisputeStatus = 'none' | 'pending' | 'accepted' | 'rejected'`, `disputeStatus?: DisputeStatus`, `evidencePhotos?: ReportPhoto[]`, `originalPlateNumber?: string`, `plateCorrectedBy?: string`, and `plateCorrectedAt?: Date | any`.
    *   Release 2: Expand `FineStatus` to `'unpaid' | 'paid' | 'cancelled'`, and add `disputeReason?: string`, `disputedAt?: Date | any`, `resolutionReason?: string`, `resolvedBy?: string`, and `resolvedAt?: Date | any` (one unified resolution triplet shared by `cancel_fine` and `dismiss_dispute`).
*   **Rationale:** Ensures Release 1 `IssueFineUseCase` compiles under `strict: true` when initializing `disputeStatus: 'none'`, snapshots `evidencePhotos` for Release 2, and avoids duplicate resolution metadata triplets.

#### 5. `functions/src/domain/value-objects/plate.ts` (Modify — Release 1)
*   **Type / Scope:** Backend Domain Value Object
*   **Proposed Changes:**
    *   Generalize `isValidScopedStoragePath` prefix union to `'carteGrise' | 'transfers' | 'reports'` and export `isValidReportPath(path: unknown, callerUid: string): path is string`.
    *   Export `isValidPlateFormat(plateNumber: string): boolean` enforcing `/^([A-Z]{2}\d{3}[A-Z]{2}|\d{1,4}[A-Z]{2,3}\d{2,3})$/` on `normalizePlate(plateNumber)` (matching `frenchPlateRegex` in `front/app/composables/useVehicleValidation.ts`).
    *   Reuse existing `validateRejectionReason(reason)` (`3–500` chars) for report dismissals, fine disputes, and dispute resolutions rather than duplicating a second reason validator.
*   **Rationale:** Aligns backend plate syntax strictly with frontend `frenchPlateRegex`, validates report Storage paths, and reuses existing reason validation.

#### 6. `functions/src/domain/repositories/storage.port.ts` & `functions/src/infrastructure/adapters/storage/StorageSignedUrlAdapter.ts` (Modify — Release 1)
*   **Type / Scope:** Backend Storage Port & Adapter
*   **Proposed Changes:**
    *   Add `verifyRasterImage(objectPath: string): Promise<boolean>` to `DocumentStoragePort` and implement it in `StorageSignedUrlAdapter` using `file.exists()` and `file.getMetadata()`, confirming `contentType` matches `^image/(jpeg|png|webp)$` and `Number(metadata.size) > 0 && Number(metadata.size) < 1572864`.
*   **Rationale:** Enables `CreateReportUseCase` to verify uploaded evidence blobs exist and hold valid raster metadata before creating a `pending` report.

#### 7. `functions/src/domain/repositories/report.repository.ts`, `functions/src/infrastructure/adapters/persistence/FirestoreReportRepository.ts`, `functions/src/infrastructure/adapters/persistence/FirestoreFineRepository.ts`, `functions/src/infrastructure/adapters/persistence/FirestoreCarRepository.ts`, & `functions/src/infrastructure/adapters/persistence/EnforcementAuditHelper.ts` (Create/Modify — Release 1 & 2)
*   **Type / Scope:** Backend Ports & Firestore Adapters
*   **Proposed Changes:**
    *   Create `EnforcementAuditHelper.ts` exporting `addEnforcementAuditLog(connector, entry: Omit<EnforcementAuditLog, 'id'>, txOrBatch?)` writing to `enforcement_audit_logs` with `serverTimestamp()` on `timestamp`, and wire it via `EnforcementAuditPort` (or shared helper in `entry-points/index.ts`) instead of duplicating `addAuditLog` across `ReportRepository` and `FineRepository`.
    *   `report.repository.ts` & `FirestoreReportRepository.ts` (Release 1): Add `update(id: string, updates: Partial<Report>, txOrBatch?: TransactionContext | any): Promise<void>`; wrap both `updateStatus` and `update` with `asFirestoreTransaction(txOrBatch)`, mapping `plateCorrectedAt` and `resolvedAt` to `serverTimestamp()` when included.
    *   `FirestoreFineRepository.ts` (Release 1 & 2): In Release 1, map `plateCorrectedAt` on `create()` to `serverTimestamp()` when included. In Release 2, map `disputedAt` and `resolvedAt` to `serverTimestamp()` inside `update()` when included, keeping `hasUnpaidFines` querying `status == 'unpaid'`.
    *   `FirestoreCarRepository.ts` (Release 1): Remove `.limit(1)` from `getByPlateNumber(plateNumber)`: query all docs matching `plateNumberNormalized == normalized`, filter out `status === 'archived' || status === 'rejected'` in memory (preferring `'active'` if multiple remain), and preserve the `getById(normalized)` fallback for legacy cars.
*   **Rationale:** Eliminates duplicate audit-log adapters, ensures authoritative server timestamps and transaction wrapping, and fixes the `.limit(1)` re-registered plate bug.

#### 8. `functions/src/application/usecases/report/create-report.ts` & `functions/src/infrastructure/entry-points/report/create-report.ts` (Modify — Release 1)
*   **Type / Scope:** Backend Use Case & Callable Entry Point
*   **Proposed Changes:**
    *   In `entry-points/report/create-report.ts`: pass `documentStoragePort` into `CreateReportUseCase`, fix payload spread order to `{ ...(request.data ?? {}), agentId: request.auth.uid }` (preventing client `agentId` spoofing), and wrap errors with `mapDomainErrorToHttpsError`.
    *   In `CreateReportUseCase`: replace `throw new Error(...)` with `throw new DomainError('PERMISSION_DENIED' | 'INVALID_ARGUMENT', ...)` and update `CreateReportRequest` to accept `photos: ReportPhoto[]`.
    *   Validate `photos` has length `2–3` with unique `path` values, unique `slot` values (`'context'` and `'plate'` mandatory, at most one `'extra'`), and `isValidReportPath(p.path, agentId)` for each item; call `documentStoragePort.verifyRasterImage(p.path)` for each item and throw `INVALID_ARGUMENT` if missing or non-raster.
    *   Validate `isValidPlateFormat(plateNumber)` and keep the requirement that either `location` or `address` is present; omit `photoUrl` on new reports; record nothing in `enforcement_audit_logs`; log structured metadata via `firebase-functions/logger`; preserve existing return `{ ok: true, reportId }`.
*   **Rationale:** Fixes `agentId` spoofing, enforces mandatory verified raster photos server-side, returns semantic error codes, and keeps the existing return contract.

#### 9. `functions/src/application/usecases/report/update-report-plate.ts` & `functions/src/infrastructure/entry-points/report/update-report-plate.ts` (Create — Release 1)
*   **Type / Scope:** Backend Use Case & Callable Entry Point (`updatePendingReportPlate`)
*   **Proposed Changes:**
    *   Define `UpdatePendingReportPlateUseCase` accepting `{ reportId, plateNumber, actorId }` and injected with `ReportRepository`, `UserRepository`, `EnforcementAuditPort`, and `TransactionRunner`.
    *   Inside `TransactionRunner`: verify caller has role `'agent'`, `report.agentId === actorId`, and `report.status === 'pending'`; require `isValidPlateFormat(plateNumber)`; store trimmed uppercase `plateNumber`, `originalPlateNumber: report.originalPlateNumber ?? report.plateNumber`, `plateCorrectedBy: actorId`, and `plateCorrectedAt: new Date()`; append `UPDATE_REPORT_PLATE` to `enforcement_audit_logs`; return `{ ok: true }`.
    *   Expose callable `updatePendingReportPlate` deriving `actorId` from `request.auth.uid` and mapping errors via `mapDomainErrorToHttpsError`.
*   **Rationale:** Lets agents correct mistyped plates on pending reports under role, ownership, and audit-log constraints.

#### 10. `functions/src/application/usecases/report/dismiss-report.ts` & `functions/src/infrastructure/entry-points/report/dismiss-report.ts` (Create — Release 1)
*   **Type / Scope:** Backend Use Case & Callable Entry Point (`dismissReport`)
*   **Proposed Changes:**
    *   Define `DismissReportUseCase` accepting `{ reportId, reason, actorId }`.
    *   Inside `TransactionRunner`: verify caller has role `'police'` and `report.status === 'pending'`; validate `reason` via `validateRejectionReason`; set `report.status = 'resolved'`, `resolutionReason`, `resolvedBy: actorId`, `resolvedAt: new Date()`; append `DISMISS_REPORT` to `enforcement_audit_logs` and log via `firebase-functions/logger`; return `{ ok: true }`.
*   **Rationale:** Gives police an explicit closure path for unreadable or unregistered reports.

#### 11. `functions/src/application/usecases/fine/issue-fine.ts` & `functions/src/infrastructure/entry-points/fine/issue-fine.ts` (Modify — Release 1)
*   **Type / Scope:** Backend Use Case & Callable Entry Point
*   **Proposed Changes:**
    *   In `entry-points/fine/issue-fine.ts`: accept optional `expectedPlateNumber` alongside `{ reportId, ownerId, plateNumber, amount, notes }` and forward to `IssueFineUseCase` (injecting `EnforcementAuditPort`).
    *   Inside `IssueFineUseCase` transaction: enforce `report.status === 'pending'` (`FAILED_PRECONDITION`); if `expectedPlateNumber` is supplied and `normalizePlate(expectedPlateNumber) !== normalizePlate(report.plateNumber)`, throw `FAILED_PRECONDITION`.
    *   Reject `car.status === 'archived' || car.status === 'rejected'` (keeping `active`, `activation_pending`, `deletion_requested`, and `transfer_pending_*` finable).
    *   Compare `const officerChanged = normalizePlate(plateNumber) !== normalizePlate(report.plateNumber)`. Set `earliestOriginal = report.originalPlateNumber ?? (officerChanged ? report.plateNumber : undefined)`. When `earliestOriginal` exists, propagate `originalPlateNumber: earliestOriginal` (and `plateCorrectedBy: officerChanged ? issuedBy : report.plateCorrectedBy`, `plateCorrectedAt: officerChanged ? new Date() : report.plateCorrectedAt`) onto `Fine`. Update `Report` via `reportRepository.update(...)` setting `status: 'investigated'` and—if `officerChanged`—updating `plateNumber` to the issued plate, `originalPlateNumber: earliestOriginal`, `plateCorrectedBy: issuedBy`, and `plateCorrectedAt: new Date()`.
    *   Snapshot `evidencePhotos: report.photos ?? []` onto `Fine`, initialize `disputeStatus: 'none'`, log `ISSUE_FINE` to `enforcement_audit_logs` and `firebase-functions/logger`, and return `{ ok: true, fineId }`.
*   **Rationale:** Prevents duplicate fines and concurrent-edit races, aligns vehicle eligibility, propagates agent and officer plate corrections accurately, and snapshots verified photos.

#### 12. `functions/src/application/usecases/evidence/get-evidence-urls.ts` & `functions/src/infrastructure/entry-points/evidence/get-evidence-urls.ts` (Create — Release 1, extended Release 2)
*   **Type / Scope:** Backend Use Case & Callable Entry Point (`getEvidenceUrls`)
*   **Proposed Changes:**
    *   Define uniform item shape `EvidenceUrlItem = { slot: ReportPhotoSlot; url: string | null; expiresAt: number | null; error?: 'not_found' }`.
    *   Release 1 (`targetType === 'report'`): authorize `'police'` or (`'agent'` with `report.agentId === callerId`); resolve `report.photos` or non-empty legacy `report.photoUrl` (returning `{ ok: true, items: [] }` if empty).
    *   Release 2 (`targetType === 'fine'`): authorize `'police'` or (`'owner'` with `fine.ownerId === callerId && fine.status !== 'cancelled'`); resolve `fine.evidencePhotos ?? []` (returning `{ ok: true, items: [] }` when absent without cross-reading `/reports`).
    *   For each item: if `path` starts with `https://` or `http://`, return `{ slot, url: path, expiresAt: null }` directly; otherwise resolve independently via `Promise.allSettled` calling `getSignedReadUrl(path, 300)`, mapping missing objects to `{ slot, url: null, expiresAt: null, error: 'not_found' }`. Return `{ ok: true, items }`.
*   **Rationale:** Centralizes private Storage authorization, emulator `http://` compatibility, historical empty fallbacks, and per-slot error isolation.

#### 13. `functions/src/infrastructure/entry-points/index.ts` (Modify — Release 1 & 2)
*   **Type / Scope:** Backend Entry Points Barrel
*   **Proposed Changes:**
    *   Export shared `enforcementAuditPort` (`EnforcementAuditHelper` instance).
    *   Release 1: Export `updatePendingReportPlate`, `dismissReport`, and `getEvidenceUrls`.
    *   Release 2: Export `disputeFine` and `resolveDispute`.
*   **Rationale:** Wires shared audit port and exposes new Cloud Functions through `functions/src/index.ts`.

### Phase 2 — Release 1 Frontend

#### 14. `front/app/composables/useImageCompression.ts` (Create — Release 1)
*   **Type / Scope:** Frontend Utility Composable
*   **Proposed Changes:**
    *   Export `useImageCompression()` exposing `compressImage(file: File): Promise<File>`.
    *   Reject `image/svg+xml` and non-`image/*` files immediately; decode accepted raster inputs (`image/jpeg`, `image/png`, `image/webp`) via `createImageBitmap` (throwing a typed unsupported-format error prompting for JPEG, PNG, or WebP if decoding fails, such as for `HEIC`/`HEIF`).
    *   Unconditionally re-encode via offscreen `<canvas>` to `image/jpeg` (removing any skip-reencoding branch so 100% of photos strip EXIF metadata): try `1600px` max edge at quality `0.8`, `0.65`, `0.5`, then `1280px` at `0.65`, `0.5` until `size <= 800 * 1024`. Accept the `1280px` / `0.5` result if `<= 1.5 * 1024 * 1024`; throw a typed over-size error if still `>= 1.5 * 1024 * 1024`.
*   **Rationale:** Strips EXIF metadata from every uploaded photo, enforces the 1.5 MB Storage ceiling client-side, and keeps compressed 3-photo batches under Cloud Functions' 10 MB callable response limit.

#### 15. `front/app/composables/useDocumentViewer.ts` (Modify — Release 1 & 2)
*   **Type / Scope:** Frontend Composable
*   **Proposed Changes:**
    *   Add `fetchEvidenceUrls(targetType: 'report' | 'fine', targetId: string): Promise<EvidenceUrlItem[]>` calling `getEvidenceUrls` with loading state and error toasts (matching existing `viewDocument` error handling).
*   **Rationale:** Reuses a single composable for signed-URL evidence resolution and error/refresh handling across Agent, Police, and Owner UIs.

#### 16. `front/app/stores/reports.ts`, `front/app/components/organisms/AgentNewReportModal.vue`, & `front/app/pages/agent/index.vue` (Modify — Release 1)
*   **Type / Scope:** Frontend Store, Modal Organism, & Agent Page
*   **Proposed Changes:**
    *   `stores/reports.ts`: Extend `Report` interface (`photos?: ReportPhoto[]`, `originalPlateNumber?`, `resolutionReason?`, etc.) and export pure `normalizeReportFromFirestore(id: string, data: DocumentData): Report` mapping legacy `photoUrl` (when non-empty) to `[{ path: data.photoUrl, slot: 'context' }]` and guarding optional timestamps (`data.plateCorrectedAt ? getTimestampMillis(data.plateCorrectedAt) : undefined`, `data.resolvedAt ? ... : undefined`); reuse `callFn`/`withLoading` from `stores/cars.ts` and add `updatePendingReportPlate(reportId, plateNumber)` and `dismissReport(reportId, reason)`.
    *   `AgentNewReportModal.vue`:
        *   Replace the single photo input with 3 capture slots (`'context'` Photo 1 required, `'plate'` Photo 2 required with explicit license-plate reminder badge, `'extra'` Photo 3 optional) with per-slot retake/remove actions, and remove the photo-skip button.
        *   Re-encode each photo eagerly on slot selection via `useImageCompression` (revoking preview object URLs via `URL.revokeObjectURL`).
        *   Add Back buttons on Steps 2–3 and display the `'plate'` slot (Photo 2) preview above `#plate-input` on Step 3.
        *   Require `authStore.currentUser?.uid` (no `'anonymous'` fallback) and upload compressed `.jpg` blobs concurrently to `reports/${uid}/${draftId}_${slot}_${crypto.randomUUID()}.jpg` via `useFirebaseStorage()` before calling `createReport`.
    *   `pages/agent/index.vue`: Display `agentReports` sorted by `timestamp` descending with status badges, opening a plate-edit modal for `pending` reports that loads evidence via `useDocumentViewer().fetchEvidenceUrls('report', id)` (with an `@error` **Refresh Photos** retry button and `not_found` slot placeholder) and saves via `updatePendingReportPlate`.
*   **Rationale:** Delivers structured 2–3 photo capture, guaranteed EXIF stripping, pre-submit verification, and pending-report plate editing.

#### 17. `front/app/stores/cars.ts`, `front/app/stores/fines.ts`, & `front/app/pages/police/index.vue` (Modify — Release 1)
*   **Type / Scope:** Frontend Stores & Police Page
*   **Proposed Changes:**
    *   `stores/cars.ts`: Update `getCarByPlate` to query `where('plateNumberNormalized', '==', normalizePlate(plate))` without a Firestore status filter, filter in client JS to `status !== 'archived' && status !== 'rejected'` (preferring `'active'`), and fall back to `doc(db, 'cars', normalizePlate(plate))` if empty.
    *   `stores/fines.ts` (Release 1 typing update): Add `import { defineStore } from 'pinia'` and `import { computed, ref } from 'vue'`, and add `expectedPlateNumber?: string` to `issueFine` payload type so Release 1 builds cleanly.
    *   `pages/police/index.vue`: Unify `isDetailOpen` and `isFineOpen` into one Review & Issue modal fetching signed URLs via `useDocumentViewer().fetchEvidenceUrls('report', id)` (with `@error` **Refresh Photos** retry and `not_found` slot fallback), displaying `'plate'` (Photo 2) alongside an editable plate input (triggering `getCarByPlate` on 300 ms debounce and an explicit **Check Plate** button), passing `expectedPlateNumber` to `issueFine`, and adding a dedicated `isDismissModalOpen` modal calling `dismissReport`.
*   **Rationale:** Fixes plate-lookup formatting mismatches, keeps Release 1 TypeScript builds green, keeps photos visible while issuing fines, and prevents concurrent-edit overwrites.

#### 18. `front/i18n/locales/en.json`, `front/i18n/locales/fr.json`, `front/i18n/locales/ar.json`, `front/vitest.config.ts`, & Release 1 Tests (Create/Modify — Release 1)
*   **Type / Scope:** Localization, Vitest Configuration, & Unit/Emulator Tests
*   **Proposed Changes:**
    *   Locales: Remove unused `skip_photo` keys and add Release 1 copy (3 photo slots, `'plate'` slot reminder, compression/HEIC/over-size errors, **Refresh Photos**, agent plate-edit modal, police unified modal & dismiss report) across `en`, `fr`, and `ar` (RTL).
    *   `front/vitest.config.ts`: Create Vitest config using built-in `node` environment and `resolve.alias: { '~': './app' }` (requiring zero new `package.json` dependencies).
    *   Backend unit tests:
        *   `functions/tests/unit/create-report.test.ts` (2–3 photos, unique slots, path scoping, Storage `verifyRasterImage` check, `frenchPlateRegex` parity, `agentId` spoofing prevention, `{ ok: true, reportId }` return).
        *   `functions/tests/unit/update-report-plate.test.ts` (`pending`-only, owner-only, `originalPlateNumber` preservation).
        *   `functions/tests/unit/dismiss-report.test.ts` (police-only, `pending`-only, reason bounds `3–500`).
        *   `functions/tests/unit/issue-fine.test.ts` (`pending` guard, `expectedPlateNumber` mismatch rejection, `rejected` car rejection, `originalPlateNumber` carry-over on agent-then-police-accept and officer edits, `evidencePhotos` snapshot, `disputeStatus: 'none'`).
        *   `functions/tests/unit/get-evidence-urls.test.ts` (`'report'` auth, per-slot `not_found` isolation, `http://` legacy fallback).
        *   `functions/tests/unit/car-repository-plate.test.ts` (`FirestoreCarRepository.getByPlateNumber` skipping `archived`/`rejected` when plate was re-registered).
    *   Emulator & frontend tests:
        *   `functions/tests/emulator/storage-rules.test.ts` (`reports/` direct read denied, `allow create` 1.5 MB + `^image/(jpeg|png|webp)$` blocking `svg`/`heic`, `update` and `delete` denied).
        *   `front/tests/useImageCompression.test.ts` (mocking `createImageBitmap` & `<canvas>`: unconditional re-encoding, SVG rejection, HEIC failure, `> 1.5 MB` rejection) and `front/tests/reportConverter.test.ts` (legacy `photoUrl` -> `context` slot & `undefined` optional timestamps).
*   **Rationale:** Keeps Release 1 localized across all supported languages and verifies Release 1 security rules, concurrency guards, and compression logic before Release 2 begins.

### Phase 3 — Release 2 Backend & Indexes

#### 19. `firestore.indexes.json` (Modify — Release 2)
*   **Type / Scope:** Firestore Composite Indexes Configuration
*   **Proposed Changes:** Add composite index on `fines` for `disputeStatus` (`ASCENDING`) + `disputedAt` (`DESCENDING`).
*   **Rationale:** Supports the Police Disputes query without full-collection scans.

#### 20. `functions/src/application/usecases/fine/dispute-fine.ts` & `functions/src/infrastructure/entry-points/fine/dispute-fine.ts` (Create — Release 2)
*   **Type / Scope:** Backend Use Case & Callable Entry Point (`disputeFine`)
*   **Proposed Changes:**
    *   Define `DisputeFineUseCase` accepting `{ fineId, reason, actorId }`.
    *   Inside `TransactionRunner`: verify `fine.ownerId === actorId`, `fine.status === 'unpaid'`, and `(fine.disputeStatus ?? 'none') === 'none'`; validate `reason` via `validateRejectionReason` (`3–500` chars); set `disputeStatus: 'pending'`, `disputeReason`, `disputedAt: new Date()`; log `DISPUTE_FINE` to `enforcement_audit_logs` and `firebase-functions/logger`; return `{ ok: true }`.
*   **Rationale:** Enables single-step disputes on unpaid fines while `Fine.status` remains `'unpaid'` (relying on existing unpaid-fine transfer guards).

#### 21. `functions/src/application/usecases/fine/resolve-dispute.ts` & `functions/src/infrastructure/entry-points/fine/resolve-dispute.ts` (Create — Release 2)
*   **Type / Scope:** Backend Use Case & Callable Entry Point (`resolveDispute`)
*   **Proposed Changes:**
    *   Define `ResolveDisputeUseCase` accepting `{ fineId, action: 'cancel_fine' | 'dismiss_dispute', reason, actorId }`.
    *   Inside `TransactionRunner`: verify caller role is `'police'`, `fine.status === 'unpaid'`, and `fine.disputeStatus === 'pending'`; validate `reason` via `validateRejectionReason`.
    *   On `'cancel_fine'`: set `fine.status = 'cancelled'`, `fine.disputeStatus = 'accepted'`, `resolutionReason`, `resolvedBy: actorId`, `resolvedAt: new Date()`; if `fine.reportId` exists, update linked `report` to `status: 'resolved'`, `resolutionReason: 'fine_cancelled'`, `resolvedBy: actorId`, `resolvedAt: new Date()`; log `CANCEL_FINE`.
    *   On `'dismiss_dispute'`: set `fine.disputeStatus = 'rejected'`, `resolutionReason`, `resolvedBy: actorId`, `resolvedAt: new Date()`; log `DISMISS_DISPUTE`. Return `{ ok: true }`.
*   **Rationale:** Moves cancelled fines out of `pendingDisputesQuery`, closes the linked report, and revokes owner signed-URL access cleanly.

#### 22. `functions/src/application/usecases/fine/pay-fine.ts`, `functions/src/infrastructure/entry-points/fine/pay-fine.ts`, `functions/src/application/usecases/car/approve-car-deletion.ts`, `functions/src/infrastructure/entry-points/car/approve-car-deletion.ts`, `functions/src/application/usecases/car/request-car-deletion.ts`, & `functions/src/infrastructure/entry-points/car/request-car-deletion.ts` (Modify — Release 2)
*   **Type / Scope:** Backend Payment & Car-Deletion Guard Updates
*   **Proposed Changes:**
    *   `entry-points/fine/pay-fine.ts`: Fix spread order to `{ ...(request.data ?? {}), userId: request.auth.uid }` (deriving `userId` from auth context rather than client payload), pass `transactionRunner` and `enforcementAuditPort` into `PayFineUseCase`, and map errors via `mapDomainErrorToHttpsError`.
    *   `PayFineUseCase`: Migrate to `TransactionRunner` + `DomainError`, reject payment when `fine.status === 'cancelled'` or `fine.disputeStatus === 'pending'`, and log `PAY_FINE` to `enforcement_audit_logs`.
    *   `request-car-deletion.ts` & `approve-car-deletion.ts` (use cases + entry-point instantiation): Add `FineRepository` parameter to both use-case constructors, pass `fineRepository` from `../index` in both entry points, and block deletion with `FAILED_PRECONDITION` whenever `hasUnpaidFines` returns `true`.
*   **Rationale:** Fixes `userId` spoofing and payment/cancellation races, and prevents car deletion when unpaid or disputed fines exist.

### Phase 4 — Release 2 Frontend, Locales, & Tests

#### 23. `front/app/stores/fines.ts`, `front/app/components/organisms/OwnerFinesTab.vue`, `front/app/components/molecules/OwnerFineCard.vue`, `front/app/pages/police/index.vue`, & `front/app/components/organisms/PoliceAuditTab.vue` (Modify — Release 2)
*   **Type / Scope:** Shared Fines Store, Owner UI, & Police Dispute/Audit UI
*   **Proposed Changes:**
    *   `stores/fines.ts`: Extend `Fine` interface (`evidencePhotos`, `originalPlateNumber`, `disputeStatus`, `disputeReason`, `resolutionReason`, `disputedAt`, `resolvedAt`, `'cancelled'`) and export pure `normalizeFineFromFirestore(id: string, data: DocumentData): Fine` guarding optional timestamps (`data.disputedAt ? getTimestampMillis(data.disputedAt) : undefined`, `data.resolvedAt ? ... : undefined`). Add `disputeFine(fineId, reason)`, `resolveDispute(fineId, action, reason)`, and role-gated `pendingDisputesQuery` (`authStore.currentUser?.uid && userStore.role === 'police'`, `where('disputeStatus', '==', 'pending')`, `orderBy('disputedAt', 'desc')`, `limit(50)`) exposing `pendingDisputes` and `pendingDisputesLoading`; align toast currency to `TND`.
    *   `OwnerFinesTab.vue`: Add a dedicated `Cancelled` section (`cancelledFines` computed filter where `status === 'cancelled'`) alongside `unpaidFines` and `paidFines` so cancelled fines stay visible.
    *   `OwnerFineCard.vue`:
        *   Add **View Evidence** button opening a zoomable Evidence modal powered by `useDocumentViewer().fetchEvidenceUrls('fine', fine.id)` (showing an empty-state notice inside the modal when `items` is empty for historical fines, `not_found` per-slot fallback, and `@error` **Refresh Photos** retry).
        *   Add **Dispute Fine** modal for `status === 'unpaid' && (disputeStatus ?? 'none') === 'none'`.
        *   Hide **Pay** while `disputeStatus === 'pending'` (keeping **Pay** enabled for `status === 'unpaid'` when `disputeStatus` is `'none'` or `'rejected'`).
        *   Scope the green check-circle icon and `"Receipt Issued"` block strictly to `fine.status === 'paid'`; render a `neutral` icon, badge (`$t('police.audit.cancelled')`), and resolution reason for `cancelled` fines; localize `formatDate` via `$i18n.locale`.
    *   `pages/police/index.vue` & `PoliceAuditTab.vue`: Add a fourth **Disputes** tab driven by `pendingDisputes` with a dispute modal displaying owner explanation, original vs. issued plate, and signed-URL photos alongside **Cancel Fine** and **Dismiss Dispute** reason modals; render `cancelled` status in `PoliceAuditTab.vue` with a `neutral` localized badge.
*   **Rationale:** Delivers owner evidence viewing, single-step fine disputes, and police dispute resolution across both dashboards.

#### 24. `front/i18n/locales/en.json`, `front/i18n/locales/fr.json`, `front/i18n/locales/ar.json`, & Release 2 Tests (Modify/Create — Release 2)
*   **Type / Scope:** Localization & Release 2 Unit/Emulator Tests
*   **Proposed Changes:**
    *   Locales: Add Release 2 copy (owner **View Evidence**, empty legacy notice, **Dispute Fine** modal, pending/rejected/cancelled badges, `police.audit.cancelled`, police **Disputes** tab, **Cancel Fine** and **Dismiss Dispute** actions) across `en`, `fr`, and `ar` (RTL).
    *   Backend unit & emulator tests:
        *   `functions/tests/unit/dispute-fine.test.ts` (owner-only, unpaid-only, historical `undefined` `disputeStatus`, max-1 dispute, `3–500` bounds).
        *   `functions/tests/unit/resolve-dispute.test.ts` (`cancel_fine` setting `status: 'cancelled'` + `disputeStatus: 'accepted'` + closing report, `dismiss_dispute` setting `rejected`, missing `reportId` guard).
        *   `functions/tests/unit/pay-fine.test.ts` (reject `cancelled` and `pending` dispute, allow `rejected` dispute, `userId` spoofing prevention, `PAY_FINE` log).
        *   `functions/tests/unit/car-deletion-fines.test.ts` (`RequestCarDeletionUseCase` & `ApproveCarDeletionUseCase` blocking unpaid/disputed fines).
        *   `functions/tests/unit/get-evidence-urls-fine.test.ts` (`'fine'` owner/police auth, cancelled fine denied for owner while allowed for police, legacy empty `[]`).
        *   `functions/tests/emulator/firestore-rules.test.ts` (owner blocked from `/reports`, `police` vs `owner` `/fines` read & `pendingDisputesQuery`, `enforcement_audit_logs` denied).
    *   Frontend unit test:
        *   `front/tests/fineConverter.test.ts` (`cancelled` status, `disputeStatus`, and `undefined` optional timestamps).
*   **Rationale:** Ensures Release 2 localization completeness and verifies dispute transitions, payment/deletion locks, and Firestore security rules.

### Verification Plan

*   **Release 1 Exit Checkpoint:**
    *   `cd functions && pnpm build && pnpm lint && pnpm test:unit`
    *   `firebase emulators:exec --only auth,firestore,storage "cd functions && pnpm test:emulator"`
    *   `cd front && pnpm build && pnpm lint && pnpm test`
*   **Release 2 Final Verification Checkpoint:**
    *   `cd functions && pnpm build && pnpm lint && pnpm test:unit`
    *   `firebase emulators:exec --only auth,firestore,storage "cd functions && pnpm test:emulator"`
    *   `cd front && pnpm build && pnpm lint && pnpm test`
*   **Manual E2E Check (Firebase Emulators):**
    *   Verify Release 1 in `agent` and `police` UIs (2–3 compressed `.jpg` photos, SVG/HEIC rejection prompt, over-1.5 MB rejection, pending plate edit, side-by-side fine issuance with plate correction, `expectedPlateNumber` stale check, dismiss report, legacy 0–1 photo rendering, and sample plate legibility check).
    *   Verify Release 2 in `owner` and `police` UIs (signed-URL evidence modal, legacy fine empty notice inside modal, **Refresh Photos** after 5-minute expiry, dispute submission preserving `unpaid` status for existing transfer guards while blocking car deletion and payment, `cancel_fine` moving the fine out of **Disputes** into **Cancelled** and revoking owner URL access, and `dismiss_dispute` restoring **Pay**).
