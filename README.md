# ParkAlert 🚔

ParkAlert is a modern, mobile-first government parking enforcement system designed to streamline the process of reporting parking violations and managing vehicle compliance.

## 🚀 Overview

The system provides three distinct role-scoped workspaces (with multi-role support so officers and agents can also manage their own personal vehicles cleanly):
- **Citizen (Owner) Dashboard**: Allows vehicle owners to register vehicles, request deletion or ownership transfer, pay fines with a simulated card modal, download PDF payment receipts, and dispute unpaid fines with explanations.
- **Agent Portal**: A specialized interface for traffic wardens to report illegally parked vehicles with 2–3 compressed photo evidence slots, automatic/validated license plate input, and pending-report plate corrections.
- **Police Control Panel**: An operational workspace for officers with deterministic oldest-first queue sorting, wait-age indicators, multi-photo evidence review, fine issuance/dispute resolution, vehicle/transfer approvals, and a lazy paginated **Police Audit Log** across all enforcement decisions.

## ✨ What's New

- **Deterministic Police Queue Sorting & Unified Audit Trail**:
  - Chronological oldest-first (`asc`) ordering and per-tab sort toggles across all five `/police` queues (vehicle activations, deletions, police-stage transfers, pending reports, and pending disputes), wait-age badges, `250+` cap indicators, and chunked (30-UID) user profile loading.
  - Transactional `police_audit_logs` ledger attributing every police action (`CAR_APPROVED`, `CAR_REJECTED`, `CAR_DELETION_APPROVED`, `TRANSFER_APPROVED`, `TRANSFER_REJECTED`, `DISMISS_REPORT`, `ISSUE_FINE`, `CANCEL_FINE`, `DISMISS_DISPUTE`), backed by Firestore security rules, composite indexes, and idempotent Fireway migration `v6__backfill_police_audit.ts`.
  - Lazy cursor-paginated Audit Log tab (`policeAudit` store) with category filters, server plate lookup, loaded-row filter, and point-lookup payment receipt verification.
- **Multi-Role Access & Self-Enforcement Prevention**: Users carry a server-managed `roles` array (`['owner']`, `['police', 'owner']`, `['agent', 'owner']`), Pinia stores dual-gate on `roles` + `route.meta.role`, and backend use cases block officers from approving, rejecting, dismissing, fining, or resolving disputes involving their own vehicles.
- **Multi-Photo Evidence & Fine Disputes**: Structured `context`, `plate`, and optional `extra` photo slots served via time-limited signed URLs (`getEvidenceUrls`), plus owner fine dispute submission (`disputeFine`) and police dispute resolution (`resolveDispute` / `dismissReport`).
- **Card Payment Modal & PDF Receipts**: Simulated fine settlement (`payFine`), isolated `/fines/{fineId}/receipt/summary` subcollections, owner PDF receipt preview/download, and police read-only verification modal.
- **UI Theme & Localization**: Light/dark semantic color tokens with manual color mode selector and EN/FR/AR localization (`@nuxtjs/i18n`).

## 🛠 Tech Stack

### Frontend
- **Framework**: [Nuxt 4](https://nuxt.com/) (configured as an SPA)
- **UI Library**: [Nuxt UI](https://ui.nuxt.com/) (Tailwind CSS based)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Firebase Integration**: [VueFire](https://vuefire.vuejs.org/) & `httpsCallable` for backend interaction.
- **Internationalization**: `@nuxtjs/i18n` (Multi-language support: EN, FR, AR).
- **Design Pattern**: Atomic Design (Atoms, Molecules, Organisms).

### Backend
- **Framework**: [Firebase Cloud Functions v2](https://firebase.google.com/docs/functions) (Node.js/TypeScript)
- **Database**: [Firestore](https://firebase.google.com/docs/firestore)
- **Authentication**: [Firebase Auth](https://firebase.google.com/docs/auth)
- **Storage**: [Firebase Storage](https://firebase.google.com/docs/storage) (for vehicle documents and report photos).

## 🏗 Architecture

### Backend: Hexagonal Architecture (Ports & Adapters)
The backend is structured to ensure that business logic remains decoupled from external frameworks and the database.

- **Domain Layer (`src/domain`)**: Contains core business entities (`User`, `Car`, `Report`, `Fine`, `PoliceAuditLog`) and Repository/Port interfaces (`PoliceAuditPort`, `EnforcementAuditPort`).
- **Application Layer (`src/application`)**: Implemented as pure Use Cases (e.g., `IssueFineUseCase`, `ResolveDisputeUseCase`, `DismissReportUseCase`, `ApproveTransferUseCase`, `PayFineUseCase`). Each use case encapsulates a single transactional business operation.
- **Infrastructure Layer (`src/infrastructure`)**:
    - **Adapters (`persistence`, `storage`)**: Concrete Firestore repositories, transactional `PoliceAuditHelper` / `EnforcementAuditHelper`, and signed-URL storage adapters.
    - **Connectors**: Centralized management of Firebase Admin SDK dependencies.
    - **Entry Points**: Firebase `onCall` functions that act as the delivery mechanism, orchestrating authentication, self-enforcement guards, and use case execution.
- **Migrations (`functions/migrations`)**: Versioned Fireway Firestore migrations (`v1`–`v6`), including `v6__backfill_police_audit.ts`.

### Frontend: Atomic Design
Components are organized into hierarchy-based categories to promote reusability and consistency:
- **Atoms**: Basic building blocks (buttons, inputs, badges).
- **Molecules**: Groups of atoms working together (search bars, user avatars).
- **Organisms**: Complex UI sections (Vehicle tabs, Profile cards, Modals).
- **Templates**: Page layouts and structural containers.

## 📦 Project Structure

```text
├── docs/designs/         # Approved feature design documents
├── front/                # Nuxt 4 Frontend
│   ├── app/
│   │   ├── components/   # Atomic Design components
│   │   ├── pages/        # Role-based routes (/owner, /agent, /police)
│   │   ├── stores/       # Dual-gated Pinia state management
│   │   └── utils/        # Timestamp, receipt PDF, and role helpers
│   └── tests/            # Vitest frontend unit tests
├── functions/            # Firebase Backend
│   ├── migrations/       # Fireway Firestore migrations (v1-v6)
│   ├── src/
│   │   ├── domain/       # Entities, errors & Ports
│   │   ├── application/  # Use Cases
│   │   └── infrastructure/# Adapters & Entry Points
│   └── tests/            # Vitest unit & Firebase emulator test suites
├── firestore.rules       # Database Security Rules
├── firestore.indexes.json# Firestore Composite Indexes
└── storage.rules         # Storage Security Rules
```

## 🛠 Setup & Development

### Prerequisites
- Node.js (`v24` for Cloud Functions)
- Firebase CLI (`npm install -g firebase-tools`)
- pnpm (`npm install -g pnpm`)

### Local Development

1. **Install Dependencies**:
   ```bash
   pnpm install
   cd front && pnpm install
   cd ../functions && pnpm install
   ```

2. **Run with Emulators**:
   From the project root:
   ```bash
   # Start the frontend dev server
   cd front && pnpm dev
   
   # In another terminal, start Firebase Emulators
   firebase emulators:start
   ```

## 🛡 Code Quality & Testing
We use **ESLint**, **Vitest**, and **Husky** to maintain high code standards.
- **Pre-commit hooks**: Automatically lint staged changes before every commit.
- **Linting & Builds**:
  - Frontend: `cd front && pnpm lint && pnpm build`
  - Backend: `cd functions && pnpm build && pnpm lint`
- **Tests**:
  - Frontend unit tests: `cd front && pnpm test`
  - Backend unit tests: `cd functions && pnpm test:unit`
  - Firebase emulator tests (rules, concurrency, migrations): `cd functions && pnpm test:emulator`

## 🔒 Security
- **Firestore Rules**: Strict multi-role (`roles` array) access control, police-only reads on `/police_audit_logs`, owner-only reads on `/fines/{fineId}/receipt/summary`, and server-only immutable `/enforcement_audit_logs`.
- **Backend Validation**: Every Use Case validates authentication, `roles` membership, ownership, and police non-self-enforcement inside Firestore transactions before mutating state.
- **Storage Security**: Files are scoped to user IDs, content types, and size limits, and sensitive documents are served exclusively via signed URLs.
