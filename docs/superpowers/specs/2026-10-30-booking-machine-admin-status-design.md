# Booking machine status reflects admin settings

## Intent

Show people booking a machine why it is unavailable when an admin has set it to maintenance, inactive, or disabled. The current booking page turns all three settings into the generic “fully booked today” status.

## Goals

- Show the specific admin status for machines that are not available.
- Keep the live queue status for machines the admin has marked available.
- Keep unavailable machines unbookable.
- Provide the status text in Thai and English.

## Non-goals

- Change which machine settings permit a booking.
- Change queue, session, or booking-time calculations.
- Change the admin settings screen or its available status options.

## Constraints

- The authoritative machine setting is `SheetMachine.status`: `available`, `maintenance`, `inactive`, or `disabled`.
- Available machines can still show `in_use`, `queued`, `waiting_for_login`, or `full_today` based on booking data.
- Available machines remain `full_today` when the requested date is not today.
- Booking data refreshes on the booking page every 10 seconds.

## Approaches

1. **Use the admin status when the machine is unavailable, and keep queue status when it is available (chosen).** This makes the reason for unavailability clear while preserving live booking information for available machines.
2. **Always show the admin status.** This would hide useful live queue information such as in-use or queued.
3. **Show both statuses.** This preserves both facts but adds a second status badge and makes the machine card more crowded.

## Behavior

- `maintenance`, `inactive`, and `disabled` appear as the matching status on the booking card and remain unbookable.
- `available` continues through the existing queue policy, which determines its displayed operational status and bookability.
- On dates other than today, a machine set to an unavailable admin status keeps that status; an available machine continues to show `full_today`.
- Add localized status text and concise explanations for the admin-controlled unavailable states.

## Implementation scope

Update the public queue status model and option-building logic, the booking card's status styling and unavailable message, and the Thai and English booking dictionaries. Preserve all existing queue and booking rules.
