# Appointment review queue — staging-only security proof

Date: 2026-09-24. Project: `nexa-staging-test` (`vbizuxxgjlwqotuegskq`).
Production (`nkxhlugrprdtqyqcahfx`) was **not modified**.

## Schema and provenance

- Supabase `apply_migration` returned `success:true` for `appointment_review_queue_staging_v1`.
- Supabase migration history assigned version `20260924172517`; the SQL snapshot is
  `docs/staging-applied/20260924172517_appointment_review_queue_staging_v1.sql`.
- This file is intentionally **not in `supabase/migrations/`**: staging had 23
  recorded canonical migrations before the experimental migration, while
  production has 24. The 20260919 audit normalization migration has not been
  synced to staging; do not treat this staging-only migration as canonical
  or apply it automatically to production. Reconcile history before a release.
- Catalog inspection: queue exists, RLS enabled, two authenticated policies
  (SELECT and INSERT), four foreign keys, one workspace/inbound unique
  constraint; authenticated INSERT allowed, UPDATE and DELETE forbidden,
  anonymous SELECT forbidden. Initial queue count: zero.

## Synthetic SQL transaction proof

Executed as the staging database administrator in a **single BEGIN/ROLLBACK**
transaction. Selected two existing owners of disjoint workspaces for identity
context; used synthetic content and newly created synthetic conversation and
inbound-message rows for the test. Impersonated `authenticated` with
`SET LOCAL ROLE authenticated` and `request.jwt.claim.sub`, rather than
using a real customer session or WhatsApp API.

Observed pass criteria:
1. Owner could insert and SELECT own pending-review row.
2. Second insert with same `(workspace_id,inbound_message_id)` raised
   `unique_violation`.
3. Authenticated UPDATE of the row raised `insufficient_privilege`.
4. A different, nonmember workspace owner saw zero rows from the first
   owner's review.
5. The second owner could not insert a review referencing the first
   owner's inbound event with a different workspace ID.
6. An actor with an empty JWT subject saw zero review rows.

The SQL returned a PASS result only after all six assertions succeeded,
then rolled back. A subsequent read-only check confirmed zero rows in the
queue and zero matching `synthetic-review-%` source messages/conversations.

## Remaining gates

This validates **staging DB SQL policy behavior**, not the complete end-to-end
authenticated Supabase client, real appointment booking, review approval,
outbound messaging, calendar integration, or production release. PR #196–#201
are stacked; none are merged or connected to a runtime route. Before enabling
a real action, reconcile migration history, generate/review a canonical migration,
verify client-session RLS and conflict semantics with two synthetic accounts,
review the API authorization flow, add human approval and action-result proof,
and separately authorize any production migration or outbound send.
