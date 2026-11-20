---
name: gov-frontend-design
description: "Create distinctive, production-grade frontend interfaces with high design quality using Nuxt 4, NuxtUI, and Tailwind CSS. Use this skill when building UI for the Government Parking Enforcement System. Generates accessible, premium, and trustworthy code that avoids generic AI aesthetics while prioritizing usability."
---

This skill guides the creation of highly usable, production-grade frontend interfaces that look like premium enterprise software, not generic templates. The output MUST be real, working, production-ready code adapted to the Nuxt 4 + NuxtUI ecosystem.

🧠 Design Thinking
Before coding, understand the context and commit to a clear, utilitarian aesthetic direction:

Purpose: What problem does this interface solve? Is it for the Agent (fast mobile data entry), the Police (dense data scanning and investigation), or the Citizen (clear status and payment)?

Tone: Premium Enterprise / Utilitarian. Must feel authoritative, accessible, and highly trustworthy.

Constraints: Framework (Nuxt 4), perfect mobile responsiveness, extremely fast performance for outdoor use.

Differentiation: What makes this interface feel like a modern, world-class civic tool rather than legacy government software?

CRITICAL: Choose a clear conceptual direction based on the user role and execute it with precision.

⚙️ Technical Requirements
Framework: Nuxt 4 (Vue 3, <script setup>, Composition API)

UI Library: NuxtUI

Styling: Tailwind CSS utility classes, augmented by scoped CSS or CSS variables for specific branding overrides.

Output MUST:

Be a complete Vue component or page.

Be directly usable in a Nuxt project.

Be rigorously responsive (Mobile-first is mandatory, especially for the Agent view).

🎨 Frontend Aesthetics Guidelines
Typography
Use highly legible, robust sans-serif fonts optimized for mobile screens and outdoor reading (e.g., Inter, Roboto, SF Pro).

Create a strict hierarchy: bold, authoritative headers combined with highly readable body text.

Ensure strict AA WCAG contrast compliance for all text.

Color & Theme
Strong, intentional palette: Use a clean, high-contrast base (whites, crisp grays, deep dark blues/blacks).

Status Colors: Use universally understood, distinct colors for status indicators (Red = Unpaid/Violation, Green = Resolved/Paid, Yellow/Amber = Pending Investigation).

Motion
Keep animations extremely fast and utilitarian.

Use subtle transitions for hover states, button presses, and modal openings.

Do not make the user wait for an animation to finish to complete their task.

Spatial Composition
Prioritize standard, predictable layouts. Do not use unconventional layouts that could confuse citizens or slow down agents.

Touch Targets: Use large, easily tappable touch targets (minimum 44x44px), especially for the Agent reporting screen.

Implement clear visual hierarchies so the primary action ("Submit Report", "Issue Fine", "Pay Fine") is instantly obvious.

Visual Details
Add depth and polish using:

Subtle, realistic drop shadows to indicate elevation (e.g., floating action buttons, modals, cards).

Crisp, 1px borders to separate dense information cleanly.

Skeleton loaders to make the app feel responsive during database reads or image uploads.

🧩 NuxtUI Usage Rules
Use NuxtUI components as a base, but customize them via the ui prop or Tailwind classes to match the premium enterprise tone.

Ensure forms (UForm, UInput, USelect) have extremely clear focus states and validation error styling.

✅ Make them feel like custom-designed, official government components.

🚫 What to Avoid
Confusing or experimental spatial layouts.

Low-contrast text or delicate, thin fonts.

Generic "AI slop" aesthetics or overly playful designs.

Default NuxtUI appearance without thoughtful configuration.

Tiny buttons or form fields that are hard to tap on a mobile device.

🧠 Final Principle
Design something that feels:

Intentional

Highly Usable

Trustworthy

Every interface should instill confidence in the citizen and provide maximum efficiency for the government worker.