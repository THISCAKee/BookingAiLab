# Booking Admin Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the admin-selected unavailable status on the booking page while preserving live queue status for available machines.

**Architecture:** Carry `maintenance`, `inactive`, and `disabled` through the public booking status model. Use those states instead of `full_today` when admin has made a machine unavailable, including when the requested date is not today. The booking card will localize and style those values; available machines retain the existing queue and bookability rules.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, existing Google Sheets machine records and Thai/English dictionaries.

**Spec:** `docs/superpowers/specs/2026-10-30-booking-machine-admin-status-design.md`

## Global Constraints

- The authoritative machine setting is `SheetMachine.status`: `available`, `maintenance`, `inactive`, or `disabled`.
- Available machines can still show `in_use`, `queued`, `waiting_for_login`, or `full_today` based on booking data.
- Available machines remain `full_today` when the requested date is not today.
- Booking data refreshes on the booking page every 10 seconds.
- Preserve all existing queue and booking rules.

## Review Focus

- Admin-unavailable machine with no bookings: show the configured status and keep it unbookable.
- Admin-unavailable machine with a current or queued booking: admin status still takes precedence, while booking rules stay unchanged.
- Admin-unavailable machine on a future date: show the configured admin status.
- Admin-available machine with an active session or queue: preserve the existing operational status.
- Admin-available machine on a future date: preserve `full_today`.

---

### Task 1: Carry admin machine status through to the booking card

**Files:**
- Modify: `lib/booking/queue-policy.ts`
- Modify: `lib/booking/actions.ts`
- Modify: `components/booking/public-booking-board.tsx`
- Modify: `lib/i18n/dictionaries.ts`

**Interfaces:**
- `QueueOperationalStatus` will include `maintenance`, `inactive`, and `disabled` alongside the existing runtime statuses.
- `buildPublicBookingOptions` will return one of those admin status values for an unavailable machine on both current and non-current dates.
- Available machines will continue using the existing queue-derived statuses and bookability values.

- [ ] **Step 1: Update the public status model and derivation**

In `lib/booking/queue-policy.ts`, add the three non-available `MachineStatus` values to `QueueOperationalStatus`. When `machine.status` is not `available`, return that exact status and `bookable: false`; preserve existing queue metadata and other rules.

In `lib/booking/actions.ts`, keep the admin status for non-available machines in the non-current-date branch. Keep the existing `full_today` result for available machines on a non-current date.

- [ ] **Step 2: Render localized admin statuses and explanations**

In both locale dictionaries, add labels for `maintenance`, `inactive`, and `disabled`, plus concise descriptions for each unavailable state. In `PublicBookingBoard`, add a status tone for each new value and show its matching unavailable description in place of the generic no-slot message. Keep the existing runtime labels and UI behavior for available machines.

- [ ] **Step 3: Check the changed files**

Review that every `QueueOperationalStatus` is covered by both locale label maps and the card tone map. Run `npx tsc --noEmit` to catch type errors. Do not add or run tests unless requested.
