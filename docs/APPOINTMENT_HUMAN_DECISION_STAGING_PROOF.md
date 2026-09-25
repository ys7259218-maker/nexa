# Human appointment review decision — staging-only proof

Date: 2026-09-24. Staging-test project `vbizuxxgjlwqotuegskq`.
Production database `nkxhlugrprdtqyqcahfx` was **not modified**.

Applied staging-only migration `20260924180931_appointment_human_decision_staging_v1`; the exact SQL snapshot is in `docs/staging-applied/20260924180931_appointment_human_decision_staging_v1.sql`. It creates immutable `appointment_review_decisions`, uniquely keyed by `review_request_id`, with two outcomes: `approved_for_manual_followup` (NOT booked) and `declined`. Each decision records the authenticated actor. RLS only grants authenticated workspace owner/admin/operator SELECT/INSERT; no authenticated UPDATE/DELETE grants or policies.

## Staging SQL role and idempotency proof

A synthetic transaction used two distinct existing workspace owner identity contexts, a newly inserted synthetic conversation and inbound message, and a synthetic review request. Owner INSERT/SELECT of an actor-attributed human decision passed. An attempted second conflicting decision raised a unique violation, UPDATE was denied, cross-workspace SELECT returned zero records, cross-workspace INSERT was denied, and an empty JWT subject saw zero decision rows. `ROLLBACK` completed. A separate postflight confirmed 0 decision rows, 0 review rows, 0 matching synthetic messages and 0 matching synthetic conversations, RLS enabled, authenticated UPDATE denied and anonymous INSERT denied.

This is a **database SQL-context test**, not real cookie-session HTTP proof. Neither migration nor synthetic test booked appointments, changed calendars, activated AI providers, or sent customer messages. The staging deployment opt-in flag remains OFF. Canonical migration history already differs between staging and production; do not copy this experimental staging migration blindly to production.

The code branch includes an authenticated, same-origin, staging-gated human decision endpoint and UI requiring an explicit checkbox acknowledgement. The inbox filters out already-decided requests by consulting the separate decision ledger. Those code paths require independent GitHub CI and authenticated staging HTTP/browser testing before they can be treated as runtime-proven. Human decisions are not permission to auto-book.
