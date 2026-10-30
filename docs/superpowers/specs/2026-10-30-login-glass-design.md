# Login Glass Design

## Intent

Refresh the BookingAiLab login page so Mahasarakham University users can identify the Google sign-in action, understand the `@msu.ac.th` requirement, and see how booking works before they continue.

## Goals

- Give the existing Google sign-in action a clear visual priority.
- Add a compact three-step usage guide to the login screen.
- Use a restrained glass surface with the existing black and yellow brand colors.
- Add purposeful entrance, hover, press, focus, and loading motion while respecting reduced-motion preferences.
- Keep Thai and English content, the language switcher, error messages, and the return-to-home link.

## Non-goals

- Change Google OAuth, routes, authentication rules, booking behavior, or the account domain requirement.
- Add a separate help route, new account options, or unrelated product content.
- Use a generated image as the page UI or as a production background asset.

## Anti-goals

- Decorative effects that compete with the sign-in action or reduce text contrast.
- Motion that blocks interaction or continues when reduced motion is requested.
- A desktop layout that becomes cramped on mobile.

## Approaches

1. **One glass card with the guide below the sign-in action (recommended).** Keep the user focused on one primary action, then show the three steps in the same panel. Use a horizontal guide on desktop and a vertical list on mobile. This matches the request for a clear login screen and keeps all essential guidance together.
2. **Split login and guide into two desktop columns.** This gives the guide more room, but makes the login surface wider and introduces a more complex mobile stack.
3. **Keep login compact and link to a separate guide.** This minimizes the page, but hides the requested help behind another navigation step.

The first approach is the working direction, based on the requested simplicity and the generated desktop and mobile mockups shown for review.

## Proposed design

- Use a white page canvas with a restrained pale amber ambient wash and very faint neutral structural lines.
- Center one translucent white glass panel with backdrop blur, a fine cool-gray edge, and a soft shadow.
- Use dark ink and slate for text contrast, keeping yellow as the primary-action and brand accent.
- Keep the existing BookingAiLab mark and TH/EN switch in a quiet top row.
- Order the panel content as: university-account heading and description, yellow Google sign-in button, `@msu.ac.th` note, divider, then a three-step guide.
- Guide steps: sign in with Google; choose a machine and confirm the booking; use the provided User and Password to sign in to TimeLock.
- Keep the return-to-home link below the panel. On mobile, stack the guide steps vertically and allow normal scrolling if needed.
- Add a short fade-and-rise entrance, subtle button hover/press feedback, clear keyboard focus, and retain the existing loading state. Disable or sharply reduce nonessential motion with `prefers-reduced-motion`.
- Keep all interface text and controls in HTML/CSS. Add Thai and English guide copy to the existing dictionaries.

## Constraints and implementation surface

- Preserve the server-rendered login page, existing async `searchParams`, locale lookup, error handling, Google OAuth endpoint, and `LoginButton` behavior.
- Reuse the existing fonts, brand mark, language switcher, and yellow/ink palette.
- Expected files: `app/login/page.tsx`, `app/globals.css`, and `lib/i18n/dictionaries.ts`; adjust `app/login/login-button.tsx` only if styling needs a stable interaction hook.

## Visual references

The generated desktop and mobile concepts were shown inline for this review. They are layout and style references only; no generated image will be shipped as UI.
