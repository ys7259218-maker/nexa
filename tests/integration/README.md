# RLS integration tests

These tests run against a real Supabase project and verify that Row Level
Security scopes every `ai_employees` operation to the authenticated owner.
They are skipped unless the following environment variables are set:

- `INTEGRATION_SUPABASE_URL` — project URL
- `INTEGRATION_SUPABASE_ANON_KEY` — browser-safe anon/publishable key only
- `INTEGRATION_TEST_EMAIL` / `INTEGRATION_TEST_PASSWORD` — dedicated test
  account credentials (create this account in the project first)

Run with:

```bash
npm run test:integration
```

Never point these variables at production, and never use the service-role
key here. Apply the migrations from `docs/SUPABASE_SETUP.md` before running.
