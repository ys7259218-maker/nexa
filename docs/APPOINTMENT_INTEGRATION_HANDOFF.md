# Nexa appointment booking — integration handoff

Date: 2026-09-25. Milestone state for the appointment-booking staging integration.

## Exact branch / commit

- Integration branch: `codex/appointment-integration-v1` (pushed to origin, tracks `codex/appointment-booking-db-adapter-v1`).
- Head commit: `cd7deff` "feat(booking): sandbox calendar provider abstraction + booking E2E flow".
- Stack: linear, 139 commits ahead of origin/main `25ddac2`; merge-base `25ddac2`. No main merge, no production deployment.

## What this milestone proves (all sandbox / credentials-free)

- `lib/booking/calendarProvider.ts` — the one calendar-provider abstraction (`AppointmentBookingProvider` + `cancelAppointment` / `rescheduleAppointment`, `sandboxOnly` flag).
- `lib/booking/sandboxCalendarProvider.ts` — deterministic, in-memory, network-free provider; honors idempotency, never leaks customer text into booking ids, no credential/network import.
- `lib/booking/appointmentSandboxFlow.test.ts` — full sandbox E2E booking flow with a faithful in-memory ledger: request → customer confirmation → owner approval → calendar event creation → booking ledger `confirmed`; plus duplicate replay, provider outage → failed → retry, rejection, in-progress/conflict fail-closed, cancel/reschedule lifecycle.
- No real calendar, no authenticated staging run, no outbound, no production change.

## Test results (head cd7deff)

- `npm run check` green: tracked-secrets ✔, production-build gate ✔, documented-count 641 ✔, lint 0 errors (6 pre-existing unused-var warnings), typecheck ✔, `npm test` 641/641 ✔, issue-reports ✔, `npm run build` ✔.

## Migration / schema status

- Canonical `supabase/migrations/` still holds 24 migrations; no SQL added.
- Booking approval/ledger schema (`docs/schema-proposals/appointment_booking_ledger_v1.sql`) is **proposal-only**, proven via BEGIN/ROLLBACK only.
- Staging-applied SQL (live on `vbizuxxgjlwqotuegskq`) lives in `docs/staging-applied/` (5 files: review queue, human decision, audit four-value bridge, pending-invoker view, etc.) — each **not** in canonical history.
- `lib/operationalDocsTruth.test.ts` guard satisfied: no new migration files, NEXA_HANDOFF still tracks 24 migrations.

## Staging evidence

- No authenticated client-session/staging-DB booking evidence at this head. Real-auth harness exists (`tests/integration/appointmentReviewAuth.test.ts`, `npm run test:integration:appointments`) but skips without credentials.

## Remaining owner actions (blocked, not executed)

1. **Booking schema reconcile vs staging** (safe, reversible): staging management token (DB execute rights on `vbizuxxgjlwqotuegskq`) or staging `INTEGRATION_*` envs + two dedicated test accounts. Then run the existing proposal/rollback SQL + `appointmentBookingSchemaContract` checks against staging.
2. **Server-only booking adapter run against real staging DB** with dedicated synthetic test data: requires `SUPABASE_SERVICE_ROLE_KEY` (empty in Vercel prod+preview) or a management token. Exercise claim/complete/release paths with synthetic workspace/review/messages, then clean up.
3. **Vercel env disposition**: `AI_PROVIDER` and `SUPABASE_SERVICE_ROLE_KEY` are EMPTY in prod & preview (verified); live prod build stays mock. Decide whether to permanently leave them unset.

## Rollback notes

- This branch is code-only and unmerged; deleting the branch or reverting `cd7deff` fully reverts this milestone.
- No migration applied by this milestone; nothing to roll back in any database.
- Production untouched: feature flags OFF, WhatsApp outbound disabled, `AI_PROVIDER` mock.