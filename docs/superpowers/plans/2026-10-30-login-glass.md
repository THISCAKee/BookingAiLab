# Login Glass Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Refresh the BookingAiLab login page with a glassy visual treatment, clear Google sign-in priority, bilingual three-step guide, and restrained interactive motion.

**Architecture:** Keep the existing async App Router page as a Server Component and reuse the existing `LoginButton`, `LanguageSwitcher`, and `BrandMark`. Add guide copy to the Thai and English dictionaries, render it in the page, and scope the new visual system and motion to login selectors in global CSS.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, existing global CSS and i18n dictionaries.

**Spec:** `docs/superpowers/specs/2026-10-30-login-glass-design.md`

## Global Constraints

- Preserve Google OAuth, routes, authentication rules, errors, loading behavior, and the `@msu.ac.th` requirement.
- Keep Thai and English content, the existing brand mark, language switcher, and return-to-home link.
- Keep the usage guide in the same panel: horizontal on desktop and vertical on mobile.
- Use code-native HTML and CSS for all text and controls; add no dependencies or production image assets.
- Respect `prefers-reduced-motion` and keep focus states visible.
- Preserve the existing user edits in `package.json` and `package-lock.json`.

## Review Focus

- Thai and English guide copy must match the active locale.
- OAuth error messages must remain visible and readable inside the new panel.
- The Google action must stay visually dominant and keyboard accessible.
- The guide must stack cleanly at narrow viewport widths without clipping.
- Reduced-motion preferences must suppress entrance and ambient animation.

No tests are included in this plan because workspace instructions say not to add or run tests unless the user asks to test or verify the implementation.

---

### Task 1: Add the localized usage guide

**Files:**
- Modify: `lib/i18n/dictionaries.ts`
- Modify: `app/login/page.tsx`

**Interfaces:**
- Reuse the existing `login` dictionary object from `getDictionary(locale)`; add a localized guide title and three ordered step strings in both Thai and English.
- Keep `LoginButton`'s current `label` and `connectingLabel` props and existing sign-in behavior.

- [x] Add the guide title and three localized steps under `login` for both locales.
- [x] Render the guide as a semantic ordered list beneath the domain note and divider, preserving the current error alert and return link.
- [x] Keep the guide wording aligned with the booking flow: Google sign-in, choose and confirm a machine, then use the issued User and Password in TimeLock.

### Task 2: Apply the glass visual system and motion

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Restructure `app/login/page.tsx` so the brand/language row, login content, and guide sit inside one `.login-panel`; keep the return link below it.
- Use stable classes `.login-panel`, `.login-header`, `.login-content`, `.login-domain-note`, `.login-guide`, `.login-guide-title`, `.login-guide-steps`, `.login-guide-step`, and `.login-guide-number`.
- Keep styles scoped to `.login-shell` so other routes retain their existing appearance.

- [x] Use a white login canvas with restrained amber ambient treatment and a translucent white blurred panel with a fine border.
- [x] Style the brand row, language control, heading, Google action, domain note, error alert, guide, and return link for clear contrast.
- [x] Lay out the three guide steps horizontally on wide screens and vertically on mobile.
- [x] Add a brief panel entrance, subtle button hover/press feedback, and visible keyboard focus; retain the existing loading spinner.
- [x] Add `prefers-reduced-motion` handling for login entrance and ambient effects.

## Plan self-review

- Spec coverage: visual treatment, localized guide, responsive layout, interactive motion, accessibility, and preserved auth behavior all have explicit tasks.
- Scope: two tasks modify only the login page, its dictionaries, and scoped global CSS.
- Tests: omitted under the workspace instruction above.
