# BookingAiLab — Phase 4 Customer Booking Design

## Status

Approved on 2026-08-13. This document defines the Phase 4 Customer Booking Flow and Admin Booking Settings boundary.

## Non-negotiable constraints

- Booking is free.
- This project has no payment system, payment provider, payment fields, payment status or payment workflow.
- Only authenticated Google users with verified `@msu.ac.th` email may book.
- Browser and WPF must never receive the Supabase Service Role Key.
- WPF implementation remains out of scope until the API Contract is ready.
- Existing confirmed bookings are not changed when settings are edited.

## User-facing behavior

The customer does not select a start time or duration. After choosing an available machine and submitting the booking request, the server starts the booking immediately using the current time in `Asia/Bangkok` and calculates the end time from the active booking duration.

Default settings are:

| Setting | Default |
| --- | --- |
| Service days | Monday–Friday |
| Opening time | 08:30 |
| Closing time | 16:30 |
| Booking duration | 180 minutes |
| No-show grace period | 15 minutes |
| Timezone | Asia/Bangkok |

A booking is accepted only when the current local time is within the configured service window and the full duration finishes by closing time. Under the defaults, new bookings are not accepted after 13:30.

The customer may have only one booking that has not reached a terminal state. A cancelled booking immediately releases the customer and machine for a new booking. A booking that has not started within the grace period becomes `expired` and releases the slot. The expiration transition must be performed by a trusted server-side workflow before a new booking relies on that slot.

## Application routes

- `/booking`: authenticated customer page listing machines with `available` status and a single immediate-booking action.
- `/my-bookings`: authenticated customer page listing only the current user's bookings and allowing cancellation where policy permits.
- `/admin/settings`: active Admin read access; only `super_admin` may update booking settings.

Email delivery, credential generation, full Admin Dashboard, Machine API and WPF client remain later-phase work. Phase 4 may create a `machine_events` row for the existing contract, but does not implement the WPF consumer.

## Server booking workflow

1. Require a valid Supabase session and verify the user's email on the server.
2. Load the active `booking_settings` row.
3. Convert the current instant to `Asia/Bangkok` and validate weekday, opening time, closing time and full duration.
4. Validate the requested machine exists and is currently `available`.
5. Expire the current user's eligible no-show booking if its grace period has elapsed.
6. Reject the request if the user still has a non-terminal booking.
7. Insert a `confirmed` booking with `start_at = now()` and `end_at = start_at + duration`.
8. Create the corresponding pending machine event in the same transaction when the event contract is required by the implementation.
9. Return the booking number and the persisted start/end timestamps.

The implementation must rely on the existing PostgreSQL exclusion constraints for machine and customer overlap protection. A race between two requests must return a controlled conflict error rather than creating duplicate bookings.

## Settings model and authorization

Add a `booking_settings` table through a Supabase migration. It stores one active global configuration with service weekdays, opening/closing local times, duration, grace period and timezone. Values must be validated by database constraints and server-side validation, including positive duration/grace values and a closing time after opening time.

Active Admins may read the settings. Only an active `super_admin` may update them. The server must reject invalid settings and must not allow an ordinary Admin to elevate their own role or change authorization data.

Settings edits affect only bookings created after the edit. Existing bookings retain their persisted timestamps and status rules.

## Error handling

The server returns stable application errors for:

- unauthenticated user;
- non-university email;
- service closed or outside configured weekday;
- insufficient remaining service time;
- machine unavailable or missing;
- customer already has an active/pending booking;
- booking conflict caused by a concurrent request;
- cancellation not allowed;
- invalid or unauthorized settings update.

The UI displays human-readable Thai messages while preserving machine-readable error codes for tests and later API consumers. It must not expose database errors, credentials, Service Role keys or internal stack traces.

## RLS and security boundary

- Customer can read only their own profile, bookings and customer notifications.
- Customer can read only available machines.
- Customer cannot read `app_credentials`, `machine_events` or `audit_logs` directly.
- Active Admin can manage operational booking data according to the Phase 3 policies.
- Only `super_admin` can update `booking_settings`.
- Booking mutation and setting mutation execute on the server using the authenticated session and database policies; no browser-side privileged client is introduced.

## Testing requirements

Tests must cover:

- authentication and `@msu.ac.th` enforcement;
- weekday and opening/closing boundary behavior;
- fixed three-hour duration and the 13:30 default cutoff;
- immediate start time and persisted end time;
- one outstanding booking per customer;
- immediate rebooking after cancellation;
- 15-minute no-show expiration;
- unavailable machine and concurrent booking conflict;
- customer isolation under RLS;
- Admin versus `super_admin` settings permissions;
- settings changes not modifying existing bookings;
- absence of payment code and privileged keys in browser code.

## Phase 4 completion boundary

Phase 4 is complete when the customer can authenticate, see available machines, create an immediate fixed-duration booking, view/cancel their own booking, and an authorized `super_admin` can edit booking settings through the Admin route with automated tests. No payment feature is to be added.
