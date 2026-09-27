# Sandbox calendar provider + booking E2E flow

Date: 2026-09-25. Code-only, unmerged. Adds the one calendar-provider abstraction for the booking milestone plus a deterministic, network-free sandbox provider and a full sandbox E2E booking-flow test. Existing booking-boundary, ledger-contract and DB-adapter slices remain as previously documented.

## Calendar provider abstraction

`lib/booking/calendarProvider.ts` defines the single `CalendarProvider` interface. It extends the executor's provider-agnostic `AppointmentBookingProvider` (so the executor contract is unchanged) with the two lifecycle operations needed to exercise cancellation and rescheduling:

- `cancelAppointment({ providerBookingId })` -> `ok` / `unknown_booking` / `already_cancelled` / `unavailable`
- `rescheduleAppointment({ providerBookingId, startsAt })` -> `ok` / `unknown_booking` / `cancelled_booking` / `invalid_time` / `unavailable`

Every implementation exposes `providerName` and a `sandboxOnly` flag so review tooling can prove a provider can never be silently dropped into a live path: real integrations must report `sandboxOnly: false` and pass a separate credentials/consent review before any production wiring.

## SandboxCalendarProvider

`lib/booking/sandboxCalendarProvider.ts` is the deterministic, in-memory, network-free implementation used **only** for sandbox milestone evidence:

- creates no external appointment, accepts no credentials;
- honors `idempotencyKey` across retries: a replayed `createAppointment` returns the stored booking with no second event;
- derives a stable `providerBookingId` (`sandbox-<sha256(key)>-<sanitized-key-tail>`) that never contains the customer request text;
- supports cancel/reschedule with the full fail-closed result set above;
- imports no `fetch`, HTTP/TLS/SMTP/network client or `process.env`, enforced by its source-level contract test.

## Sandbox E2E booking flow

`lib/booking/appointmentSandboxFlow.test.ts` proves the complete chain at the sandbox level without a database, network, credential or real customer data:

`request -> customer confirmation -> owner approval -> calendar event creation -> booking ledger confirmed`

It drives the real `executeApprovedAppointmentBooking` against `SandboxCalendarProvider` plus an in-memory ledger that faithfully mirrors the server-only adapter: unique row keyed by idempotency column, `claimed -> confirmed/failed` state machine, failed-only reacquire, and 23505-style conflict classification when the same key arrives under a different workspace/review request.

Covered paths:

- full happy-path chain produces exactly one calendar event and a `confirmed` ledger row;
- duplicate execution replays the stored booking without a second event (`replayed: true`);
- provider outage marks the attempt `failed`, then a retry reacquires and succeeds;
- provider rejection is never reported as booked; ledger row is `failed`;
- in-progress and conflicting claims fail closed without reaching the provider;
- cancel (one-shot, `already_cancelled` repeat), reschedule, and reschedule-after-cancel (`cancelled_booking`) lifecycle.

## Status

- Sixteen new tests; runner total is **641** (625 prior + 16). Full `npm run check` passes at the integration-branch head.
- No real calendar provider, provider credentials, authenticated staging run, booking ledger schema apply, outbound message, staging flag activation or production change. Live-staging reconcile + server-only adapter run remain blocked on staging credentials (see handoff).