# Appointment booking execution boundary

Date: 2026-09-25. Code-only, unmerged. No calendar provider, production route, customer message or database migration is activated by this slice.

## What this adds

`lib/actions/appointmentBooking.ts` is the first side-effect boundary for a future real appointment calendar integration. It accepts only a server-assembled `BookingAuthorization` containing workspace/review IDs, an explicit future requested time, customer confirmation timestamp, and human approval identity/timestamp. Browser JSON or model output must never construct this object directly.

Before any provider call the executor acquires a ledger claim keyed only by `workspaceId + reviewRequestId`. A duplicate confirmed replay returns the stored booking without a second provider call; in-progress or conflicting claims fail closed. Provider implementations are independently required to honor the same idempotency key so that an external booking is not duplicated if the provider succeeds but local ledger completion later fails.

The executor never returns `confirmed` when the provider rejects, throws, returns a mismatched appointment time, or the ledger cannot persist completion. It sends no outbound customer message.

## Tests

Ten deterministic unit tests cover invalid/stale authorization, future approval/confirmation rejection, single provider execution, confirmed replay, in-progress/conflict suppression, provider rejection/outage, mismatched provider time, ledger-completion failure and ledger-claim outage.

This is **not yet real booking**. Remaining work: trusted database authorization/booking ledger schema, adapter implementation, a chosen calendar provider, provider sandbox credentials, authenticated staging E2E, customer-consent policy and production release approval.
