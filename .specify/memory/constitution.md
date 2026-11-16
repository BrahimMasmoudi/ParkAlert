# ParkAlert Constitution

## Core Principles

### I. Hexagonal Backend Separation

All backend business logic under `functions/src/` MUST adhere strictly to Hexagonal Architecture (Ports and Adapters):
- `domain/` (`entities/`, `repositories/`) MUST remain pure TypeScript and MUST NOT import Firebase Admin SDK, Cloud Functions triggers, or external framework dependencies.
- `application/` (`usecases/`, `ports/`) MUST encapsulate each business operation in a dedicated Use Case that depends only on domain entities and repository/service interfaces.
- `infrastructure/` (`adapters/`, `connectors/`, `entry-points/`) MUST contain all Firestore persistence implementations, Firebase Admin SDK connectors, and Cloud Functions v2 `onCall` entry points. Entry points MUST act solely as delivery and authentication-wiring layers and MUST NOT embed domain rules or bypass Use Cases.

**Rationale**: Decoupling domain logic from Firebase infrastructure keeps enforcement rules (fines, reports, vehicle registration, ownership transfers) auditable, portable, and independently testable.

### II. Server-Authoritative Writes & Least-Privilege Security (NON-NEGOTIABLE)

All application state mutations MUST be server-authoritative:
- Client code in `front/` MUST NOT perform direct writes to Firestore (`firestore.rules` MUST keep `allow write: if false` on collections and default-deny `allow read, write: if false` on `/{document=**}`).
- Every mutation MUST execute through an authenticated Firebase Cloud Functions v2 `onCall` entry point and validate caller authentication, role (`owner`, `agent`, or `police`), and resource ownership inside the corresponding Use Case.
- Firestore read rules MUST remain scoped by verified role and ownership (`users`, `reports`, `fines`, `cars` including `ownershipHistory`).
- Firebase Storage rules (`storage.rules`) MUST require authentication, scope uploads to `request.auth.uid`, enforce the `< 10 MB` maximum size, and restrict content types (`image/*` for `/reports/{agentId}/`; `image/*` or `application/pdf` for `/carteGrise/{ownerId}/`).
- Private Admin SDK credentials MUST NEVER be exposed in frontend runtime configuration or client bundles.

**Rationale**: ParkAlert handles government parking enforcement, fines, vehicle registrations, and ownership transfers; client-side bypasses or over-broad rules create direct legal and security exposure.

### III. Atomic Design & Role-Separated Frontend

The frontend under `front/` MUST operate as a Nuxt 4 Single Page Application (`ssr: false`) using Nuxt UI, Pinia stores, and VueFire:
- UI components MUST follow Atomic Design under `front/app/components/` (`Atoms/`, `molecules/`, `organisms/`, plus shared layouts/templates), avoiding duplicated UI primitives.
- Role-specific experiences (Citizen/Owner Dashboard, Agent Portal, Police Control Panel) MUST enforce access boundaries via global route middleware (`auth.global.ts`, `role.global.ts`) in addition to backend enforcement.
- Backend communication from Pinia stores or composables MUST invoke Cloud Functions via `httpsCallable` rather than reimplementing business rules client-side.

**Rationale**: Separating presentational hierarchy, state stores, and role routing keeps the three user portals maintainable and consistent.

### IV. Multilingual & RTL-First Inclusivity

All user-facing copy in `front/` MUST support every configured locale in `front/nuxt.config.ts`:
- Supported locales are French (`fr`, default), English (`en`), and Arabic (`ar` with `dir: 'rtl'`).
- New pages, components, validation errors, and status labels MUST use `@nuxtjs/i18n` translation keys across all active locale files (`en.json`, `fr.json`, `ar.json`) rather than hardcoded strings.
- UI layouts MUST be verified against RTL (`ar`) directionality (logical spacing, icon orientation, and alignment).

**Rationale**: ParkAlert serves citizens, traffic agents, and police officers across multilingual and RTL contexts; untranslated strings or broken RTL layouts degrade usability and compliance.

### V. Spec-Driven & Fresh-Eyes Design Verification

Non-trivial features, security rule changes, and architectural refactors MUST use the combined Spec Kit and Elephant-Goldfish Model (EGM) workflow before implementation:
- Establish requirements and edge cases in specifications (`/speckit-specify` or `/egm-draft`) before writing application code.
- Specifications and significant design documents SHOULD be stress-tested by fresh, zero-context Goldfish reviewers (`/egm-review` or `/egm-review-loop`) to uncover unstated assumptions, role/permission gaps, and architectural drift prior to task execution.
- Implementation plans (`/speckit-plan`) and task lists (`/speckit-tasks`) MUST explicitly verify compliance with Principles I–IV before `/speckit-implement` begins.

**Rationale**: Separating context-heavy drafting (Elephant) from stateless review (Goldfish) prevents confirmation bias and catches security or hexagonal-boundary regressions before code is written.

### VI. Simplicity, Code Reuse & Quality Gates

Changes MUST favor simplicity, reuse of existing domain/UI abstractions, and clean static checks:
- Developers and AI agents MUST reuse existing domain entities, repository ports, Pinia stores, and Atomic Design components rather than introducing parallel implementations.
- All code modifications MUST pass ESLint in `front/` (`pnpm lint`), ESLint in `functions/` (`pnpm lint`), and TypeScript compilation (`pnpm build` in `functions/`) without suppressed errors.
- Any deviation from this Constitution MUST be documented with explicit justification in the feature's `plan.md` Complexity Tracking table and approved prior to implementation.

**Rationale**: Enforcing uniform lint, build, and reuse standards prevents technical debt across the frontend and Cloud Functions codebases.

## Technical & Security Constraints

- **Package Manager & Node Runtime**: `pnpm` across workspace packages; Firebase Cloud Functions v2 targeting `nodejs24` in region `europe-west3`; Firestore `(default)` database in `eur3`; `fireway` for Firestore migrations.
- **Frontend Stack**: Nuxt 4 (`ssr: false`), `@nuxt/ui`, `@pinia/nuxt`, `nuxt-vuefire`, `@nuxtjs/i18n`, `@nuxtjs/color-mode` (default `dark`), TypeScript.
- **Backend Stack**: `firebase-functions` v6, `firebase-admin` v13, TypeScript (`tsc`).
- **Firebase Emulators (`firebase.json`)**: Local verification targets Auth (`9099`), Functions (`5001`), Firestore (`8080`), Storage (`9199`), Hosting (`5000`), and Emulator UI (`4000`).
- **Hosting & Entry Points**: Static SPA output at `front/.output/public` with SPA rewrite to `/index.html`; Cloud Functions exported from `functions/src/index.ts`.

## Development Workflow & Quality Gates

1. **Branching**: All changes MUST be developed on dedicated feature or setup branches off `main`; direct commits to `main` MUST be avoided.
2. **Pre-Commit Enforcement**: Root Husky `.husky/pre-commit` runs `lint-staged` in both `front/` and `functions/`. Bypassing pre-commit hooks (`--no-verify`) MUST NOT be used for normal development.
3. **Security Rule Reviews**: Any modification to `firestore.rules`, `storage.rules`, or Cloud Function role/ownership checks MUST be audited for privilege escalation, role bypass, and least-privilege compliance before merge.
4. **Spec Artifacts**: Feature specs, plans, and tasks generated via Spec Kit MUST remain synchronized with implemented code; drift between docs and code SHOULD be checked with `/egm-drift-report`.

## Governance

- **Supremacy**: This Constitution supersedes ad-hoc conventions and informal agent instructions for ParkAlert. All implementation plans, specifications, PRs, and code reviews MUST verify alignment with these principles.
- **Amendments**: Amendments require updating `.specify/memory/constitution.md` via `/speckit-constitution`, documenting the change rationale in the Sync Impact Report, and obtaining user/maintainer approval.
- **Versioning Policy**: Constitution versions follow semantic versioning (`MAJOR.MINOR.PATCH`):
  - `MAJOR`: Backward-incompatible principle removals or redefinitions.
  - `MINOR`: New principle/section added or materially expanded governance rules.
  - `PATCH`: Clarifications, typo fixes, or non-semantic refinements.
- **Compliance Reviews**: Every feature `plan.md` MUST pass a Constitution Check against Core Principles I–VI before task execution; any unresolved violation blocks implementation until either resolved or explicitly justified and approved.

**Version**: 1.0.0 | **Ratified**: 2026-11-16 | **Last Amended**: 2026-11-16
