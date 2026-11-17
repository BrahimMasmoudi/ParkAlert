# ParkAlert Light/Dark Theme Fix and Manual Color Mode Selector

* **Author:** BrahimMasmoudi
* **Status:** Proposed
* **Date:** 2026-11-17

--------------------------------------------------------------------------------

## Overview

This design fixes ParkAlert's light and dark theme rendering across the Nuxt 4 frontend (`front/`) and gives every user manual control over the display mode (`Light`, `Dark`, or `System`). Today, modals appear with white overlays and unreadable dark labels and input fields, while the application forces `dark` mode for all users—hindering parking Agents who submit reports outdoors on mobile phones in bright sunlight.

The change restores expected Nuxt UI v4 (`@nuxt/ui` 4.12.2) and Tailwind CSS v4 token resolution, replaces hardcoded dark-only colors and outdated `:ui` overrides with theme-aware semantic tokens across Owner, Agent, and Police screens (including Arabic RTL on modified components), switches the default preference to `system` with `light` fallback, and exposes a shared mode selector persisted in `localStorage`.

## The Problem

ParkAlert users currently hit two coupled usability problems:

1. **Broken modal, label, and input contrast:** Opening modals such as adding a vehicle (`OwnerAddCarModal.vue`) or creating a parking alert (`AgentNewReportModal.vue`) renders white overlays alongside dark, nearly invisible labels and text inputs. This happens because `front/app/assets/css/main.css` imports `@nuxt/ui` before `tailwindcss` (breaking the Tailwind v4 token cascade), several components pass outdated Nuxt UI v2 `:ui` object shapes that v4 drops, and hardcoded dark classes (`bg-slate-950`, `bg-slate-900`, `text-white`) collide with Nuxt UI v4's portal and semantic defaults.
2. **No way to adapt to outdoor daylight vs. indoor/night work:** `front/nuxt.config.ts` locks `colorMode.preference` and `colorMode.fallback` to `'dark'`, leaving broken modal/form contrast in dark mode and no light mode. Field Agents work outdoors on phones where dark backgrounds are hard to read in sunlight, while Police officers review dense tables on desktop PCs and Owners switch between phones and PCs.

## Goals

* Render every modal overlay, modal body, form label, text input, card, dropdown, and Police data table at WCAG AA contrast (at least 4.5:1 for normal text and 3:1 for UI borders and controls) in both Light and Dark modes.
* Change the default `@nuxtjs/color-mode` configuration from forced `'dark'` to `'system'` with `'light'` fallback.
* Provide a manual 3-way selector (`Light`, `Dark`, `System`) accessible from both authenticated dashboards (`AppHeader.vue`) and entry pages (`/login` and `/onboarding`), persisted per browser in `localStorage`.
* Preserve layout and alignment in French (`fr`), English (`en`), and Arabic RTL (`ar`) across mobile (320px+) and desktop viewports without changing information hierarchy.

## Non-Goals

* **UI layout redesign:** Card layouts, modal structures, tabs, and Police tables remain unchanged.
* **Pre-hydration splash adaptation (`front/spa-loading-template.html`):** Leaving the static loading template untouched; Light-mode users may briefly see the existing dark splash screen before Vue mounts.
* **Post-login navigation freeze and missing loader:** The separate screen freeze when transitioning from `/login` to role dashboards is an auth, router, or Firestore lifecycle issue and will be investigated separately.
* **Cross-device account persistence or backend changes:** Mode choices stay local to the browser (`localStorage`); no Firestore profile fields, Cloud Functions, or security rules are modified.

## Open Questions

None.

--------------------------------------------------------------------------------

## Critical User Journeys (CUJs)

### CUJ 1: Vehicle Owner Adds a Car in Dark or Light Mode

* **Given**: An Owner is on `/owner` on mobile or desktop with either Dark or Light mode active.
* **When**: The Owner opens the Add Car modal (`OwnerAddCarModal.vue`) and fills in the plate number, brand, model, color, and Carte Grise (vehicle registration document) upload field.
* **Then**: The modal backdrop/overlay, dialog surface, form field labels, placeholders, input text, validation errors, and upload dropzone meet >= 4.5:1 text contrast and >= 3:1 UI border contrast in both modes.

### CUJ 2: Field Agent Files a Parking Report Outdoors on Mobile

* **Given**: An Agent opens ParkAlert on a mobile phone outdoors in bright daylight (with OS Light mode enabled, or after manually selecting Light mode).
* **When**: The Agent opens the New Report modal (`AgentNewReportModal.vue`) or edits a plate in `/agent`, captures photos, enters plate/location notes, and switches between French, English, and Arabic (`ar` RTL).
* **Then**: Surfaces render on light backgrounds with dark text (`>= 4.5:1` contrast) and high-contrast warning/role accents (`text-amber-700`, `bg-amber-700 text-white`), without horizontal header overflow at 320px+ or broken RTL alignment.

### CUJ 3: Police Officer Reviews Tables and Modals on PC

* **Given**: A Police officer views `/police` on desktop in either Light or Dark mode.
* **When**: The officer switches across Cars, Reports, Disputes, and Audit tabs and opens review, fine, or dispute modals.
* **Then**: Every `<UTable>` cell (including plate numbers, monetary amounts, status badges, and empty states) and every modal dialog renders with >= 4.5:1 text contrast and >= 3:1 border contrast in both Light and Dark modes.

### CUJ 4: User Switches Mode Manually Across Login and Authenticated Views

* **Given**: A user visits `/login`, `/onboarding`, or an authenticated role dashboard (`AppHeader.vue`).
* **When**: The user opens the color mode selector, switches among `Light`, `Dark`, and `System`, and reloads the page.
* **Then**: The theme updates immediately without breaking layout or RTL positioning, persists across page reloads via `localStorage`, and follows OS appearance changes when `System` is selected.

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

### 1. CSS Cascade, Color Mode Config & Brand Tokens

* **Canonical Tailwind v4 + Nuxt UI v4 import order (`front/app/assets/css/main.css`)**: Import `@import "tailwindcss";` before `@import "@nuxt/ui";` so Tailwind's base layers and palette variables are defined before Nuxt UI injects its `@theme` semantic tokens (`--ui-bg`, `--ui-bg-elevated`, `--ui-text`, `--ui-text-highlighted`, `--ui-text-muted`, `--ui-border`) and class-based `@custom-variant dark` rule (`html.dark`). Fixing this cascade restores semantic token resolution for Nuxt UI's default `<body>`-portaled `UModal` overlays (`bg-elevated/75`) and surfaces (`bg-default`), while hardcoded component overrides are cleaned up in Section 3.
* **Single `@nuxtjs/color-mode` configuration (`front/nuxt.config.ts`)**: `front/nuxt.config.ts` currently lists `'@nuxtjs/color-mode'` redundantly in `modules` alongside `'@nuxt/ui'` (which already bundles and configures it with `classSuffix: ''`). Remove `'@nuxtjs/color-mode'` from `nuxt.config.ts` `modules` (keeping `"@nuxtjs/color-mode"` in `front/package.json` for explicit dependency/type resolution) and set `colorMode: { preference: 'system', fallback: 'light' }`. Keep the default `storage: 'localStorage'` and `storageKey: 'nuxt-color-mode'` (returning browsers that previously cached `'dark'` keep `'dark'` until manually switched; see Risks & Mitigations).
* **Unified brand primary token (`front/app/app.config.ts`)**: `app.config.ts` currently sets `primary: 'emerald'`, while the header/login shield uses `blue-600` and Owner/Police tabs/buttons use `indigo-*`. Align `ui.colors` to `{ primary: 'blue', neutral: 'slate' }` and replace hardcoded `indigo-*` interactive overrides with `primary` tokens so interactive states match across Owner, Agent, Police, and Auth views.

### 2. Color Mode State Flow & Shared Layout Composition

```text
+-------------------------------------------------------------------+
|  Browser localStorage ('nuxt-color-mode') + OS prefers-color-scheme|
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|  useColorMode() (@nuxtjs/color-mode via @nuxt/ui)                 |
|  - preference: 'system' | 'light' | 'dark'                        |
|  - value (resolved): 'light' | 'dark'  --> updates <html class=""> |
+-----------------+-------------------------------+-----------------+
                  |                               |
                  v                               v
+---------------------------------+ +-------------------------------+
|  layouts/auth.vue               | |  layouts/default.vue          |
|  (login, onboarding)            | |  (owner, agent, police)       |
|  - Top-end utility bar:         | |  - AppHeader.vue:             |
|    MoleculesColorModeMenu       | |    Role badge +               |
|    MoleculesLanguageMenu        | |    MoleculesLanguageMenu +    |
+---------------------------------+ |    MoleculesColorModeMenu +   |
                                    |    Sign-out UButton           |
                                    +---------------+---------------+
                                                    |
                                                    v
+-------------------------------------------------------------------+
|  Semantic UI Surfaces (bg-default, bg-elevated, text-default,     |
|  border-default) + Portaled <body> UModal / UDropdownMenu         |
+-------------------------------------------------------------------+
```

* **New `ColorModeMenu` molecule (`front/app/components/molecules/ColorModeMenu.vue`, auto-imported as `MoleculesColorModeMenu`)**: Mirrors `LanguageMenu.vue` (`front/app/components/molecules/LanguageMenu.vue`, auto-imported as `MoleculesLanguageMenu`) using `UDropdownMenu` and an icon-only ghost `UButton` (`color="neutral" variant="ghost"` with `min-w-[44px] min-h-[44px]` touch target). The trigger icon tracks `colorMode.preference` (`lucide:monitor` for `'system'`, `lucide:sun` for `'light'`, `lucide:moon` for `'dark'`), while menu item labels reuse `@nuxt/ui`'s built-in `useLocale().t('colorMode.system' | 'light' | 'dark')` translations (leaving only `theme.aria_label` in `front/i18n/locales/*.json`). No `try/catch` wrapper is placed around `colorMode.preference` because `@nuxtjs/color-mode` handles `localStorage` errors internally inside `plugin.client.js`.
* **New `auth.vue` layout (`front/app/layouts/auth.vue`)**: Replaces the duplicated `definePageMeta({ layout: false })` gradient + blur-orb shells on `login.vue` and `onboarding.vue` with one theme-aware layout (`min-h-screen bg-default text-default relative`) and an `absolute top-4 end-4` utility bar mounting `MoleculesColorModeMenu` and `MoleculesLanguageMenu`. Transient redirect spinner `pages/index.vue` uses `definePageMeta({ layout: false })` with `bg-default text-muted` to avoid flashing header menus during initial auth redirect.
* **320px mobile header fit (`AppHeader.vue`)**: Enforce `min-w-[44px] min-h-[44px]` on `MoleculesColorModeMenu`, `MoleculesLanguageMenu`, and `#signout-header-btn` (removing `h-9` and `size="sm"`), add `min-w-0` + `truncate` on the title/subtitle container, and `shrink-0` on the right-side control group so narrow 320px French and Arabic headers do not wrap or overflow.

### 3. Semantic Token, Legacy `:ui` & Dead-Code Cleanup

* **Remove broken Nuxt UI v2 `:ui` overrides and props**: Replace nested `:ui="{ label: { base: '...' } }"` on `UFormField` and `:ui="{ body: { padding: '...' } }"` on `UCard` with Nuxt UI v4 string slots or Nuxt UI defaults; remove invalid `UButton` props (`color="white"`, `:padded="false"`); add `color="neutral"` to ghost `UButton` triggers where needed; and delete unused legacy `front/app/components/molecules/UserSelectMenu.vue` (zero callers in `front/app`).
* **Eliminate hardcoded dark-only surfaces**: Replace `bg-slate-950`, `bg-slate-900`, `bg-slate-800`, `border-slate-700`/`800`, and `text-white` (outside solid accent backgrounds) across layouts, modals, cards, dropzones, skeletons, and `UTable` cells with semantic utilities (`bg-default`, `bg-elevated`, `bg-muted`, `text-highlighted`, `text-default`, `text-muted`, `border-default`).
* **Target dual-mode contrast pairings**: Replace low-luminance shades (`text-amber-400`/`300`, `text-green-500`, `text-red-400`/`500`, `bg-amber-500 text-white`, translucent `bg-white/5`) with dual-mode candidate pairings (`text-amber-700 dark:text-amber-400`, `text-emerald-700 dark:text-emerald-400`, `text-red-700 dark:text-red-400` / `text-error`, `bg-amber-700 hover:bg-amber-600 text-white`, and solid `bg-elevated` cards) to verify against >= 4.5:1 text and >= 3:1 border thresholds.

### 4. Scoped RTL & Locale Integration

* **Built-in `<UApp>` locale bridge**: `@nuxt/ui` v4 auto-generates `#build/ui-i18n.mjs` when `@nuxtjs/i18n` is active, providing `localeContextInjectionKey` to `<UApp>` without manual `@nuxt/ui/locale` imports in `app/app.vue`. Keep `front/app/plugins/i18n.ts` updating `document.documentElement.dir` and add `document.documentElement.lang` synchronization.
* **Logical CSS properties on touched components**: Because `AppHeader.vue`, `auth.vue`, `login.vue`, `onboarding.vue`, `owner/index.vue`, `OwnerProfileCard.vue`, `OwnerCarCard.vue`, `OwnerFineCard.vue`, `OwnerAddCarModal.vue`, `AgentNewReportModal.vue`, `PoliceCarReviewModal.vue`, and Police tabs are already modified for theme remediation, convert physical directional utilities in those files (`right-*`, `left-*`, `text-left`, `text-right`, `mr-*`, unmirrored `lucide:arrow-right`) to logical properties (`end-*`, `start-*`, `text-start`, `text-end`, `me-*`, `rtl:rotate-180`) and mark plate inputs/displays `dir="ltr"`.

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative A: Patching Only `OwnerAddCarModal.vue` and `AgentNewReportModal.vue` in Forced Dark Mode

* **Pros**: Smallest immediate diff touching only the two modals initially reported as broken.
* **Cons**: Leaves over ten other `UModal`, `UFormField`, and `UTable` components broken or inconsistent, and keeps outdoor field Agents locked into dark mode in bright sunlight.
* **Reason for Rejection**: Field Agents require a user-selectable Light mode outdoors on mobile, and fixing `main.css` CSS cascade affects all portaled modals across Owner, Agent, and Police views.

### Alternative B: Adding `dark:` Utility Pairs to Hardcoded `slate-*` Classes Across Components

* **Pros**: Keeps existing `bg-slate-900` / `bg-slate-950` visual styling untouched in Dark mode without relying on `--ui-*` CSS variables.
* **Cons**: Doubles utility class duplication on every container, card, modal, and label; creates two competing theme systems whenever Nuxt UI primitives (`UTable`, `UModal`, `UInput`) update; and increases the risk of contrast regressions when components omit a `dark:` pair.
* **Reason for Rejection**: Migrating surfaces and text to Nuxt UI v4 semantic tokens (`bg-default`, `bg-elevated`, `text-default`, `text-muted`, `border-default`) resolves Light and Dark modes from a single source of truth.

### Alternative C: Building a Custom Pinia Theme Store and `localStorage` Persistence Layer

* **Pros**: Centralizes theme preferences alongside other Pinia stores (`auth`, `user`, `cars`).
* **Cons**: Duplicates `@nuxtjs/color-mode`'s built-in reactive `preference`, OS `prefers-color-scheme` listener, `<html>` class toggling, and `localStorage` persistence (`nuxt-color-mode`), risking state desynchronization between Pinia and `<html class="dark|light">`.
* **Reason for Rejection**: `@nuxtjs/color-mode` (bundled with `@nuxt/ui` v4) already handles `System`, `Light`, and `Dark` state and `localStorage` persistence natively.

### Alternative D: Using `UColorModeSelect` Directly in `AppHeader.vue` Instead of a Compact Icon Dropdown

* **Pros**: Requires no custom dropdown menu component and renders Nuxt UI's built-in select UI directly.
* **Cons**: Renders a wide select box with visible option text, crowding `AppHeader.vue` on 320px–375px mobile viewports beside the role pill, `LanguageMenu`, and sign-out button (especially with longer French and Arabic translations).
* **Reason for Rejection**: Building `MoleculesColorModeMenu` with `UDropdownMenu` mirrors `LanguageMenu.vue`'s compact 44px icon trigger, fits 320px–375px mobile headers without wrapping or horizontal overflow, and still reuses `@nuxt/ui`'s `useLocale()` `colorMode.*` translations and `useColorMode().preference`.

### Alternative E: Adapting `front/spa-loading-template.html` for Light/System Pre-Hydration Styling

* **Pros**: Prevents a brief dark loading splash before Vue mounts for OS Light-mode users (achievable with a `@media (prefers-color-scheme: light)` CSS block).
* **Cons**: Modifies static boot HTML outside the Nuxt/Tailwind pipeline and diverges for users who manually override OS dark mode unless inline storage-reading script is added.
* **Reason for Rejection**: Kept out of scope to limit changes to the Nuxt runtime application.

### Alternative F: Bundling the Post-Login Navigation Freeze and Missing-Loader Fix

* **Pros**: Addresses another user-reported pain point in the same milestone.
* **Cons**: Couples an authentication, router-middleware, and Firestore loading-state bug to CSS cascade and UI token changes, expanding regression risk and verification scope.
* **Reason for Rejection**: Tracked as a separate follow-up fix so theme remediation and manual mode switching ship independently.

--------------------------------------------------------------------------------

## Non-Functional Requirements

* **Accessibility & Contrast**: Normal body, label, and table text must target WCAG AA (`>= 4.5:1` contrast) and UI borders, inputs, and badges must target `>= 3:1` contrast in both Light and Dark modes, with `>= 44px × 44px` touch targets on header controls for mobile Agents.
* **Rollout & Rollback**: Pure frontend change with no database or Cloud Functions modifications; rolling back requires only reverting the frontend build.

## Risks & Mitigations

* **Returning browsers locked in `'dark'` under `nuxt-color-mode`**: Retaining `storageKey: 'nuxt-color-mode'` means returning devices that previously cached `'dark'` stay in Dark mode until manually switched. *Mitigation*: Expose `MoleculesColorModeMenu` prominently in both `AppHeader.vue` and `layouts/auth.vue`; if field Agents report staying stuck in Dark mode outdoors, rotate `storageKey` (e.g., `'parkalert-color-mode'`) in a 1-line config follow-up.
* **Restricted WebViews blocking `localStorage`**: `@nuxtjs/color-mode` wraps `localStorage` reads/writes in internal `try/catch` blocks (`plugin.client.js`), so errors will not crash the app, though selections will reset on reload. *Mitigation*: Accept session-only fallback in storage-blocked WebViews.
* **320px mobile header crowding in French/Arabic**: Adding a fourth right-side control in `AppHeader.vue` risks wrapping on 320px screens. *Mitigation*: Enforce `min-w-0 truncate` on the title/subtitle block and `shrink-0` on the action group, and verify 320px viewports in `fr` and `ar`.
* **Light-mode contrast regressions in amber/status/button tokens**: Standard `amber-600`, `green-500`, `red-400`, and `bg-amber-500 text-white` fail 4.5:1 on light surfaces. *Mitigation*: Standardize on `text-amber-700`, `text-emerald-700`, `text-red-700`, and `bg-amber-700 text-white` in Light mode and inspect every modal/table in DevTools.
* **Future PRs reintroducing raw dark utilities**: Without a custom template linter, new features could introduce `bg-slate-900` or `text-white`. *Mitigation*: Document semantic tokens (`bg-default`, `bg-elevated`, `text-default`) in code review guidelines and keep `app.config.ts` as the central theme config.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Migration Pattern Matrix (Applies Across All Phase 2 & 3 Vue Components)

| Pattern Category | Legacy / Broken Pattern | Target Semantic Replacement |
| :--- | :--- | :--- |
| **Root & Page Surfaces** | `bg-slate-950 text-white`, `bg-slate-900`, `bg-slate-800/60`, `bg-white/5` | `bg-default text-default`, `bg-elevated`, `bg-muted` |
| **Borders & Dividers** | `border-slate-700`, `border-slate-800`, `border-white/10`, `divide-slate-800/50` | `border-default`, `divide-default` |
| **Text Hierarchy** | `text-white` (on surfaces), `text-slate-100/200/300`, `text-slate-400/500/600` | `text-highlighted`, `text-default`, `text-muted`, `text-dimmed` |
| **Modal / Input / Card `:ui`** | `UModal` dark `content`/`header`; `UFormField` `:ui="{ label: { base: ... } }"`; `UCard` `:ui="{ body: { padding: ... } }"`; `UInput`/`UTextarea` dark `base` | Remove dark surface `:ui` overrides; use v4 string slots (`:ui="{ body: 'p-0 sm:p-0' }"`) only for layout spacing |
| **Buttons & Brand Accents** | `UButton` `color="white"`, `:padded="false"`, uncolored ghost triggers; `indigo-*` tabs/links; `bg-amber-500 text-white` | `color="neutral" variant="outline"` (`white`), `class="p-0"` (`padded`), `color="neutral"` on ghost triggers; `primary` (`blue`) for interactive accents; `bg-amber-700 hover:bg-amber-600 text-white` for Agent CTAs |
| **Status Text (Target >= 4.5:1)** | `text-amber-400`/`300`/`200`, `text-green-500`, `text-red-400`/`500` | `text-amber-700 dark:text-amber-400` (or `dark:text-amber-300`), `text-emerald-700 dark:text-emerald-400`, `text-red-700 dark:text-red-400` / `text-error` |
| **RTL & Bidi Hygiene** | `right-*`, `left-*`, `mr-*`, `ml-*`, `text-left`, `text-right`, `arrow-right` | `end-*`, `start-*`, `me-*`, `ms-*`, `text-start`, `text-end`, `rtl:rotate-180`; `dir="ltr"` on plates and `TND` amounts |

---

### Phase 1: CSS Cascade, Config & Localization Foundation

1. **[`front/app/assets/css/main.css`](../../front/app/assets/css/main.css) (Modify)**: Place `@import "tailwindcss";` before `@import "@nuxt/ui";` so Nuxt UI's `--ui-*` semantic CSS variables and `.dark` custom variant evaluate in cascade order for layouts and `<body>`-portaled overlays.
2. **[`front/nuxt.config.ts`](../../front/nuxt.config.ts) (Modify)**: Remove the duplicate `'@nuxtjs/color-mode'` entry from `modules` (`@nuxt/ui` registers it with `classSuffix: ''`) and set `colorMode: { preference: 'system', fallback: 'light' }` (keeping default `storageKey: 'nuxt-color-mode'` and `storage: 'localStorage'`; retain `"@nuxtjs/color-mode"` in `front/package.json` for dependency/type resolution).
3. **[`front/app/app.config.ts`](../../front/app/app.config.ts) (Modify)**: Change `ui.colors.primary` from `'emerald'` to `'blue'` (retaining `neutral: 'slate'`).
4. **[`front/app/plugins/i18n.ts`](../../front/app/plugins/i18n.ts) (Modify)**: Set `document.documentElement.lang` alongside `document.documentElement.dir` inside the locale watcher.
5. **[`front/i18n/locales/en.json`](../../front/i18n/locales/en.json), [`fr.json`](../../front/i18n/locales/fr.json), [`ar.json`](../../front/i18n/locales/ar.json) (Modify)**: Add identical keys under `theme.aria_label` (`"Color mode"` / `"Mode d'affichage"` / `"وضع العرض"`), `common.language_aria` (`"Change language"` / `"Changer de langue"` / `"تغيير اللغة"`), and `common.sign_out_aria` (`"Sign out"` / `"Se déconnecter"` / `"تسجيل الخروج"`), keeping full parity across all 3 files.
6. **[`front/tests/transfer-ui-i18n.spec.ts`](../../front/tests/transfer-ui-i18n.spec.ts) (Modify)**: Assert that `theme.aria_label`, `common.language_aria`, and `common.sign_out_aria` exist across `en`, `fr`, and `ar` alongside existing `flattenKeys()` parity checks.

*Phase 1 Checkpoint:* Run `pnpm test` and `pnpm lint` in `front/` (requires `ENVIRONMENT` / `.env` only for `pnpm build`).

---

### Phase 2: Color Mode Selector, Shared Layouts, Header & Shared Molecules

7. **[`front/app/components/molecules/ColorModeMenu.vue`](../../front/app/components/molecules/ColorModeMenu.vue) (Create)**: Build a `UDropdownMenu` mirroring `LanguageMenu.vue` (`align: 'end'`, semantic Nuxt UI dropdown defaults with no custom dark `:ui` colors). Use a ghost icon-only `UButton` (`color="neutral" variant="ghost"`, `min-w-[44px] min-h-[44px]`, `:aria-label="$t('theme.aria_label')"`) whose icon tracks `colorMode.preference` (`lucide:monitor` for `'system'`, `lucide:sun` for `'light'`, `lucide:moon` for `'dark'`). Populate the 3 items (`system`, `light`, `dark`) using `@nuxt/ui`'s `useLocale().t('colorMode.*')` labels, bind `onSelect` to `colorMode.preference = mode`, and mark the active item with `lucide:check` in `text-primary`.
8. **[`front/app/layouts/auth.vue`](../../front/app/layouts/auth.vue) (Create)**: Shared layout for `login.vue` and `onboarding.vue` using `min-h-screen bg-default text-default relative flex items-center justify-center p-4`, subtle decorative orbs (`-top-40 -end-40` and `-bottom-40 -start-40` with `bg-primary/10`), and an `absolute top-4 end-4 z-10 flex items-center gap-2` bar mounting `MoleculesColorModeMenu` and `MoleculesLanguageMenu`.
9. **[`front/app/layouts/default.vue`](../../front/app/layouts/default.vue) (Modify)**: Replace `bg-slate-950 text-white` with `bg-default text-default`.
10. **[`front/app/components/AppHeader.vue`](../../front/app/components/AppHeader.vue) (Modify)**: Apply Migration Pattern Matrix (`bg-default/90 border-default text-highlighted text-muted`); add `min-w-0` + `truncate` on the title/subtitle container and `shrink-0` on the action group; mount `MoleculesColorModeMenu` next to `MoleculesLanguageMenu`; add `color="neutral"`, `min-w-[44px] min-h-[44px]` (removing `size="sm"`), and `:aria-label="$t('common.sign_out_aria')"` to `#signout-header-btn`; remove unused `locale`; update `roleConfig` colors and backgrounds to `text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/25`, `text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/25`, and `text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25`.
11. **Shared Molecules & Cleanup**:

| File | Action | Specific Changes Beyond Matrix |
| :--- | :--- | :--- |
| [`front/app/components/molecules/LanguageMenu.vue`](../../front/app/components/molecules/LanguageMenu.vue) | Modify | Remove dark `:ui` overrides (`bg-slate-900`, `border-slate-800`, `text-slate-300`), remove `hover:bg-slate-800/50` and `text-blue-400` -> `text-primary`, add `color="neutral"`, `min-w-[44px] min-h-[44px]` (replacing `h-9`), `:aria-label="$t('common.language_aria')"`, and remove unused `DropdownMenuItem` import (`L26`). |
| [`front/app/components/LoadingSkeleton.vue`](../../front/app/components/LoadingSkeleton.vue) | Modify | Replace `bg-slate-800/60`, `border-slate-700/50`, and `bg-slate-700` with `bg-elevated`, `border-default`, and `bg-muted`. |
| [`front/app/components/molecules/EvidenceGallery.vue`](../../front/app/components/molecules/EvidenceGallery.vue) | Modify | Apply Matrix to empty state/captions, convert `UCarousel` `:ui` (`prev`/`next` `bg-elevated border-default text-default`, `dot` `bg-muted data-[state=active]:bg-primary`), and change `text-indigo-400` to `text-primary`. |
| [`front/app/components/molecules/PoliceSearchBar.vue`](../../front/app/components/molecules/PoliceSearchBar.vue) | Modify | Remove hardcoded `bg-slate-900 border-slate-800` `:ui` override on `UInput`. |
| [`front/app/components/molecules/UserSelectMenu.vue`](../../front/app/components/molecules/UserSelectMenu.vue) | Delete | Remove dead legacy Nuxt UI v2 component (zero callers in `front/app`). |

*Phase 2 Checkpoint:* Run `pnpm lint`, `pnpm test`, and `pnpm build` in `front/`.

---

### Phase 3: Entry Pages, Role Dashboards, Modals & Tables

12. **Entry, Owner, Agent & Police Pages and Organisms (all Modify)**:

| File | Specific Changes Beyond Migration Pattern Matrix |
| :--- | :--- |
| [`front/app/pages/index.vue`](../../front/app/pages/index.vue) | Add `definePageMeta({ layout: false })` and replace `bg-slate-950` / `text-slate-400` with `bg-default` / `text-muted` (`text-primary` spinner). |
| [`front/app/pages/login.vue`](../../front/app/pages/login.vue) | Switch `definePageMeta` from `layout: false` to `layout: 'auth'`; drop duplicated outer `min-h-screen` gradient/orb wrapper; convert `UCard` from `bg-white/5 border-white/10` to `bg-elevated border-default`; add `border border-default` to `#google-signin-btn` so the white button has a visible edge in Light mode. |
| [`front/app/pages/onboarding.vue`](../../front/app/pages/onboarding.vue) | Switch `definePageMeta` to `layout: 'auth'`; drop outer `min-h-screen` wrapper; convert `#signout-btn` (`<button>`) to `<UButton color="neutral" variant="ghost">`; style role cards with `bg-elevated border-default text-start` (selected `ring-2 ring-primary`, checkmark `<UIcon>` in `text-primary` instead of `text-white`); remove unused `router` (`L85`). |
| [`front/app/pages/owner/index.vue`](../../front/app/pages/owner/index.vue) | Apply Matrix to header and `UTabs` (`bg-elevated border-default`, `primary` indicator instead of `bg-indigo-600`); replace `text-indigo-400` (`L7`) and `shadow-indigo-500/20` (`L50`) with `primary`; change `right-6` FAB to `end-6`. |
| [`front/app/pages/agent/index.vue`](../../front/app/pages/agent/index.vue) | Apply Matrix to list cards and edit-plate `UModal`; keep `#new-report-btn` (`<button>`) layout with `bg-amber-700 hover:bg-amber-600 text-white` and `text-amber-100`; apply `text-amber-700 dark:text-amber-400`, `text-red-700 dark:text-red-400`, and `dir="ltr"` on plates. |
| [`front/app/pages/police/index.vue`](../../front/app/pages/police/index.vue) | Apply Matrix to `UTabs` (`primary` indicator instead of `bg-indigo-600`) and all 5 inline `UModal` dialogs (fine, dismiss, reject car, approve/reject dispute), `UTextarea` / `UInput` / `UCheckbox`, error alerts (`bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-400`), and `dir="ltr"` on plate badges. |
| [`front/app/components/molecules/OwnerCarCard.vue`](../../front/app/components/molecules/OwnerCarCard.vue) | Fix `UCard` `:ui="{ body: 'p-0 sm:p-0' }"`; replace `UButton` `color="white"` with `color="neutral" variant="outline"` and remove `:padded="false"` (`L247`); apply Matrix to status banners (`bg-amber-500/10`, `bg-red-500/10`, `bg-primary/10`), `text-primary`, `mr-1` -> `me-1`, and `dir="ltr"` on plate text. |
| [`front/app/components/molecules/OwnerFineCard.vue`](../../front/app/components/molecules/OwnerFineCard.vue) | Apply Matrix to card and both `UModal`s (`L129`, `L158`), replace `text-green-500` -> `text-emerald-700 dark:text-emerald-400`, `text-amber-700 dark:text-amber-400`, `text-red-700 dark:text-red-400`, `text-right` -> `text-end`, and `dir="ltr"` on plate text. |
| [`front/app/components/organisms/OwnerProfileCard.vue`](../../front/app/components/organisms/OwnerProfileCard.vue) | Fix `UCard` `:ui="{ body: 'p-0 sm:p-0' }"`; apply Matrix (`bg-elevated`, `divide-default`, `bg-primary/10 text-primary`); change `right-4` to `end-4`. |
| [`front/app/components/organisms/OwnerVehiclesTab.vue`](../../front/app/components/organisms/OwnerVehiclesTab.vue) | Apply Matrix (`bg-elevated`, `border-default` replacing `border-slate-800` and `bg-slate-900`, `text-primary` replacing `text-indigo-400`). |
| [`front/app/components/organisms/OwnerFinesTab.vue`](../../front/app/components/organisms/OwnerFinesTab.vue) | Apply Matrix to `bg-red-950` / `bg-slate-800` section dividers (`border-default` / `bg-border`), headers, and `text-green-500` -> `text-emerald-700 dark:text-emerald-400`. |
| [`front/app/components/organisms/OwnerAddCarModal.vue`](../../front/app/components/organisms/OwnerAddCarModal.vue) | Remove `UModal`, `UFormField` v2 `{ label: { base } }`, and `UInput` `:ui` dark overrides; style Carte Grise dropzone with `bg-elevated border-default` (active `border-primary bg-primary/5`) and `text-default` / `text-muted`; replace `indigo`/`amber`/`emerald`/`red-400` text with semantic/dual-mode shades; add `dir="ltr"` on plate `<UInput>` (`L24`). |
| [`front/app/components/organisms/OwnerDeleteCarModal.vue`](../../front/app/components/organisms/OwnerDeleteCarModal.vue) | Remove `UModal` dark `:ui` override and update `text-amber-400` (`L12`) to `text-amber-700 dark:text-amber-400`. |
| [`front/app/components/organisms/OwnerEditProfileModal.vue`](../../front/app/components/organisms/OwnerEditProfileModal.vue) | Remove `UModal`, `UFormField` v2 `{ label: { base } }`, and `UInput` dark `:ui` overrides; remove `hover:bg-slate-800` on Cancel `UButton` (`L79`). |
| [`front/app/components/organisms/AgentNewReportModal.vue`](../../front/app/components/organisms/AgentNewReportModal.vue) | Remove `UModal` and `UTextarea` (`L132`) dark `:ui` overrides; apply Matrix to step progress (`bg-muted`, `L9`), photo cards/dropzone, `text-amber-700 dark:text-amber-300` reminders, and `#submit-report-btn` / amber buttons (`L99`, `L148`, `L197` -> `bg-amber-700 hover:bg-amber-600 text-white`); `mr-2` -> `me-2`; `dir="ltr"` on plate input/preview. |
| [`front/app/components/organisms/PoliceCarReviewModal.vue`](../../front/app/components/organisms/PoliceCarReviewModal.vue) | Apply Matrix to `bg-slate-800`, `border-slate-700/800`, `text-slate-200/500`, `text-amber-700 dark:text-amber-400` (`L20`), and transfer card (`bg-primary/10 border-primary/25 text-primary`, `L56-57`); add `rtl:rotate-180` to `lucide:arrow-right`; `dir="ltr"` on plates. |
| [`front/app/components/organisms/PoliceCarsTab.vue`](../../front/app/components/organisms/PoliceCarsTab.vue) | Apply Matrix to `bg-slate-900/50`, `border-default`, `text-slate-500/600`, `text-amber-700 dark:text-amber-400` (`L18`), raw `<button>` (`L130` -> `text-primary`), and `dir="ltr"` on plates. |
| [`front/app/components/organisms/PoliceReportsTab.vue`](../../front/app/components/organisms/PoliceReportsTab.vue) | Apply Matrix to empty-state containers and `<UTable>` cell slots; `text-amber-700 dark:text-amber-400` and `dir="ltr"` on plates. |
| [`front/app/components/organisms/PoliceDisputesTab.vue`](../../front/app/components/organisms/PoliceDisputesTab.vue) | Replace `text-white` amounts with `text-highlighted` (`dir="ltr"` / `text-end`), `text-amber-700 dark:text-amber-400` on plates (`dir="ltr"` on `L17`), and Matrix on empty states. |
| [`front/app/components/organisms/PoliceAuditTab.vue`](../../front/app/components/organisms/PoliceAuditTab.vue) | Apply Matrix to `bg-slate-900/50`, `border-default`, `text-slate-500/600`, `text-highlighted` on amounts (`dir="ltr"`), and `text-amber-700 dark:text-amber-400` on plates (`dir="ltr"`). |

*Phase 3 Checkpoint:* Run `pnpm lint`, `pnpm test`, and `pnpm build` in `front/`.

---

### Phase 4: Verification Plan

* **Static Analysis & Linting**: Run `pnpm lint` (`eslint .`) in `front/` with zero errors or formatting violations (`eslint.config.mjs`).
* **Unit Tests**: Run `pnpm test` (`vitest run`) in `front/` and confirm all existing specs (`transfer-ui-i18n.spec.ts` including the new aria-label keys, `stores-gating.spec.ts`, `fineConverter.test.ts`, `reportConverter.test.ts`, `useImageCompression.test.ts`) pass.
* **Compilation / Build**: Run `pnpm build` in `front/` (with required `.env` / `ENVIRONMENT` public config set) to verify Nuxt/Vite/Tailwind v4 bundling succeeds with zero errors.
* **Visual / Contrast & RTL Verification Matrix**: Manually inspect all 5 routes (`/login`, `/onboarding`, `/owner`, `/agent`, `/police`) across **2 modes (`Light` × `Dark`) × 2 directions (`fr`/`en` LTR × `ar` RTL)** in browser DevTools, checking:
  * All `UModal` dialogs (`OwnerAddCarModal`, `OwnerEditProfileModal`, `OwnerDeleteCarModal`, `AgentNewReportModal`, `agent/index` edit modal, `PoliceCarReviewModal`, Police fine/reject/dispute modals, `OwnerFineCard` evidence/dispute modals) for visible backdrop, surface, label, placeholder, and input text contrast (`>= 4.5:1` text, `>= 3:1` UI borders).
  * All 4 Police `UTable` views (`Cars`, `Reports`, `Disputes`, `Audit`) for readable row cells, `TND` amounts (`dir="ltr"`), and plate badges (`dir="ltr"`).
  * `MoleculesColorModeMenu` switching across `System`, `Light`, and `Dark` in both `AppHeader` (320px mobile width in `fr` and `ar` without wrapping or horizontal overflow) and `layouts/auth.vue`, plus persistence under `localStorage['nuxt-color-mode']` across reload and OS theme change when `System` is selected.

--------------------------------------------------------------------------------

*Drafted with EGM*
