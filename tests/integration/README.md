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
