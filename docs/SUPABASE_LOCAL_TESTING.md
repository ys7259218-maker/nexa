# Safe local Supabase migration verification

Nexa pins the Supabase CLI to `2.116.0` as a development dependency and commits `supabase/config.toml`. This local gate is intentionally unlinked: it must never connect to, reset, or push a hosted project.

## Prerequisites

- Node.js 22.6 or newer (the repository currently requires this; the CLI itself requires Node.js 20+).
- Docker Desktop or another Docker-compatible engine installed and running.
- At least 7 GB of memory is recommended for the full local stack. Nexa's verifier starts only local Postgres through `supabase db start`.
- A clean checkout with no `supabase/.temp/project-ref` marker.

Install the exact locked dependencies with `npm ci`. Do not install a global Supabase CLI and do not replace the exact version with a floating range.

## One-command gate

```powershell
npm run verify:supabase:local
```

The verifier performs these steps and stops on the first failure:

1. Confirms the reviewed local config exists and the project id is `nexa`.
2. Refuses to run if the checkout contains a hosted-project link marker.
3. Confirms the local Docker engine is available.
4. Starts local Postgres only.
5. Resets the **local** database twice with every canonical migration and no seed data.
6. Runs Supabase database lint and fails on errors.
7. Prints the local migration-history list.

The two resets are destructive to the local Nexa database only. They do not use `--linked`, `--project-ref`, `db push`, an access token, or a database password. The local database remains running for inspection afterward; stop only this project with `npx supabase stop` when finished. Never use `--all --no-backup`.

## Evidence and limitations

A passing local gate proves that the ordered SQL can be applied twice to a fresh local database and passes the CLI schema linter. It does **not** prove hosted migration safety, existing-data upgrade safety, RLS isolation between real authenticated accounts, backup/restore, Meta readiness, or production deployment readiness.

Record redacted results in `docs/SUPABASE_MIGRATION_EVIDENCE.md`. Dedicated hosted-test execution still requires synthetic accounts and the six `INTEGRATION_*` variables documented in `tests/integration/README.md`. Keep every rollout flag false throughout both local and hosted proof.
