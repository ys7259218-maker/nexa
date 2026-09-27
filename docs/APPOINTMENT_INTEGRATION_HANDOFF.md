# Nexa appointment booking — integration handoff

Date: 2026-09-25. Milestone state for the appointment-booking staging integration.

## Exact branch / commit

- Integration branch: `codex/appointment-integration-v1` (pushed to origin, tracks `codex/appointment-booking-db-adapter-v1`).
- Head commit: `290225b` "docs(booking): refresh integration handoff with completed staging reconcile at head 467f462".
- Stack: linear, 139 commits ahead of origin/main `25ddac2`; merge-base `25ddac2`. No main merge, no production deployment.

## What this milestone proves

- `lib/booking/calendarProvider.ts` — the one calendar-provider abstraction (`AppointmentBookingProvider` + `cancelAppointment` / `rescheduleAppointment`, `sandboxOnly` flag).
- `lib/booking/sandboxCalendarProvider.ts` — deterministic, in-memory, network-free provider; honors idempotency, never leaks customer text into booking ids, no credential/network import.
- `lib/booking/appointmentSandboxFlow.test.ts` — full sandbox E2E booking flow with a faithful in-memory ledger: request → customer confirmation → owner approval → calendar event creation → booking ledger `confirmed`; plus duplicate replay, provider outage → failed → retry, rejection, in-progress/conflict fail-closed, cancel/reschedule lifecycle.
- **Live staging reconcile (read-only, `467f462`)** — authenticated against the real staging project with dedicated local `.env.local` accounts: the review-queue stack is applied and empty; the proposal-only booking ledger schema is **not applied** (so no booking ledger exists and the server-only adapter cannot run yet). See `docs/APPOINTMENT_BOOKING_STAGING_RECONCILE.md`.
- **Gated live-adapter runner (`290225b`)** — `npm run test:integration:booking-ledger-run` serves as the go-button for the last step: it imports the real server-only adapter (via `--conditions=react-server`), and the moment the booking ledger schema + fixture chain exist on staging it claims/confirms/replays against the real tables with a sandbox provider and deletes all fixture rows. Its skip-branch (schema absent) was live-verified against staging today. Fixture + steps: `docs/APPOINTMENT_BOOKING_STAGING_FIXTURE.md`.
- No real calendar, no booking, no outbound, no production change.

## Test results (head 290225b)

- `npm run check` green: tracked-secrets ✔, production-build gate ✔, documented-count 641 ✔, lint 0 errors (pre-existing unused-var warnings only), typecheck ✔, `npm test` 641/641 ✔, issue-reports ✔, `npm run build` ✔.
- Draft PR #215 CI check-runs all green at head `290225b`: lint/typecheck/test/build, tracked-secret guard, dependency audit, Vercel preview.
- `test:integration:appointments` (2/2) and `test:integration:booking-reconcile` (2/2) pass with local `.env.local` staging credentials injected; `test:integration:booking-ledger-run` live-preflight verified (skip-branch, schema absent) and becomes live evidence once unblocked. All report **skipped** in CI (no credentials), so a green CI is not staging evidence.

## Migration / schema status

- Canonical `supabase/migrations/` still holds 24 migrations; no SQL added.
- Booking approval/ledger schema (`docs/schema-proposals/appointment_booking_ledger_v1.sql`) is **proposal-only**, proven via BEGIN/ROLLBACK only, and confirmed still absent on staging by the live reconcile.
- Staging-applied SQL (live on `vbizuxxgjlwqotuegskq`) lives in `docs/staging-applied/` (5 files: review queue, human decision, audit four-value bridge, pending-invoker view, etc.) — each **not** in canonical history.
- `lib/operationalDocsTruth.test.ts` guard satisfied: no new migration files, NEXA_HANDOFF still tracks 24 migrations.

## Staging evidence (new at 467f462)

- Read-only authenticated reconcile against staging `vbizuxxgjlwqotuegskq` with dedicated `INTEGRATION_*` accounts from `.env.local`:
  - `appointment_review_requests`, `appointment_review_decisions`, `pending_appointment_review_inbox` — present and readable, empty (no real data).
  - `appointment_booking_approvals`, `appointment_booking_attempts` — **absent**; direct SELECT/INSERT fail closed.
- No DDL, booking, outbound, real customer data or production access was involved.

## Remaining owner actions

1. **Server-only booking adapter live run** (the only remaining step; one go-button is now ready): apply the proposal-only ledger schema to staging (`docs/schema-proposals/appointment_booking_ledger_v1.sql`, staging dashboard SQL editor, reversible), seed the fixture chain (`docs/APPOINTMENT_BOOKING_STAGING_FIXTURE.md`), then run `npm run test:integration:booking-ledger-run` with staging creds + `INTEGRATION_SUPABASE_SERVICE_ROLE_KEY`. The runner confirms + replays against the real tables, proves authenticated-write denial, and cleans up. Requires a valid staging management token (the local `SUPABASE_ACCESS_TOKEN` is revoked — 401; `SUPABASE_SERVICE_ROLE_KEY` is empty in Vercel prod/preview) or owner-applied DDL from the dashboard.

## Resolved actions

- **Booking schema reconcile vs staging** — completed at `467f462` (read-only evidence above).
- **Vercel env disposition** — verified via the Vercel API: `AI_PROVIDER`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_OUTBOUND_ENABLED` and `PRODUCTION_RELEASE_APPROVED` are all EMPTY in prod & preview; the prod live build therefore stays mock. Decision recorded: leave them unset/empty; no env revert needed.
- **PR #215 drafted** — integration branch (head `290225b`) is on GitHub as a draft PR with all CI checks green; ready to review/merge once the live run evidence lands.

## Rollback notes

- This branch is code-only and unmerged; deleting the branch or reverting `290225b` (and prior head commits) fully reverts this milestone.
- No migration applied by this milestone; nothing to roll back in any database.
- Production untouched: feature flags OFF, WhatsApp outbound disabled, `AI_PROVIDER` mock.