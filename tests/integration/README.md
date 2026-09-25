# RLS integration tests

These tests run against a real Supabase project and verify that Row Level
Security scopes every `ai_employees` operation to the authenticated owner.
They are skipped unless the following environment variables are set:

- `INTEGRATION_SUPABASE_URL` — project URL
- `INTEGRATION_SUPABASE_ANON_KEY` — browser-safe anon/publishable key only
- `INTEGRATION_TEST_EMAIL` / `INTEGRATION_TEST_PASSWORD` — dedicated test
  account credentials (create this account in the project first)
- `INTEGRATION_TEST_EMAIL_B` / `INTEGRATION_TEST_PASSWORD_B` — a second
  dedicated account in a different personal workspace; required for the
  two-tenant isolation suite

Run with:

```bash
npm run test:integration
```

Never point these variables at production, and never use the service-role
key here. Apply the canonical `supabase/migrations/*.sql` chain in the exact
order from `supabase/migrations/README.md` before running. Record the run in
`docs/SUPABASE_MIGRATION_EVIDENCE.md`. The suite intentionally changes test-only
rows and leaves the tested workspace paused.

Issue-reporting coverage uses synthetic text only. The two-account suite checks
reporter creation/read, cross-workspace read/create denial, and immutable-row
behavior. Before rollout, extend the dedicated test project with Admin,
Operator, and Viewer members to prove Admin triage and Operator/Viewer denial
for reports created by a different member; repository scaffolding alone is not
live RLS evidence.

## Appointment-review real Auth smoke (read-only)

Run `npm run test:integration:appointments` to check authenticated inbox/history access with two dedicated owner accounts in **staging-test only**. See `docs/APPOINTMENT_REVIEW_AUTH_INTEGRATION.md` for exact configuration and proof limitations. The CI workflow invokes this command without credentials and reports the real-auth test as **skipped**; this is a guard/compilation check, not a successful live authentication or browser-cookie end-to-end test. It makes no database writes and sends no messages.

## Booking ledger reconcile + live adapter run (read-only; gated)

- `npm run test:integration:booking-reconcile` — read-only reconcile asserting the review stack is present/empty and the proposal-only booking ledger tables are absent on staging (fails closed). See `docs/APPOINTMENT_BOOKING_STAGING_RECONCILE.md`.
- `npm run test:integration:booking-ledger-run` — gated live server-only adapter run. Requires `INTEGRATION_SUPABASE_SERVICE_ROLE_KEY` (the staging service-role key) **in addition** to the account creds, and is run with `--conditions=react-server` so it may import the server-only adapter. It skips (with the reason) until the booking ledger schema and the fixture chain from `docs/APPOINTMENT_BOOKING_STAGING_FIXTURE.md` are applied to staging; then it claims/confirms/replays against the real tables with a sandbox provider and deletes every fixture row. Never production.
