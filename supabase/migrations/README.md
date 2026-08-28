# Nexa Supabase migration chain

This directory is Nexa's canonical ordered SQL migration package for a fresh or isolated Supabase environment. The files use unique 14-digit version prefixes; the exact reviewed order is:

| Version | Migration | Reviewed source |
| --- | --- | --- |
| `20260824000100` | Baseline `ai_employees` table and owner RLS | First SQL block in `docs/SUPABASE_SETUP.md` |
| `20260824000200` | Settings columns and dashboard tables/RLS | Settings SQL block in `docs/SUPABASE_SETUP.md` |
| `20260824000300` | WhatsApp channels, conversations, messages, ledger/RLS | WhatsApp SQL block in `docs/SUPABASE_SETUP.md` |
| `20260824000400` | Workspace tenancy foundation | `docs/migrations/20260824_workspace_tenancy_foundation.sql` |
| `20260824000500` | One-time workspace tenancy cutover | `docs/migrations/20260824_workspace_tenancy_cutover.sql` |
| `20260824000600` | Employee lifecycle and employee kill switch | `docs/migrations/20260824_employee_lifecycle.sql` |
| `20260824000700` | Client-immutable audit events | `docs/migrations/20260824_audit_events.sql` |
| `20260824000800` | Workspace kill switch | `docs/migrations/20260824_workspace_kill_switch.sql` |
| `20260824000900` | Team role management guards | `docs/migrations/20260824_team_role_management.sql` |
| `20260824001000` | Immutable employee settings versions and guarded restore | `docs/migrations/20260824_employee_versions.sql` |
| `20260824001100` | Structured per-employee Knowledge v0 with verified-only use | `docs/migrations/20260824_knowledge_v0.sql` |
| `20260827183015` | Explicit WhatsApp channel-to-employee assignment | `docs/migrations/20260827_whatsapp_channel_assignment.sql` |

`lib/workspaceMigrations.test.ts` fails if a migration is missing, renamed, reordered, duplicated, or differs from its reviewed source. Change the reviewed source and packaged migration together, with a security review; never edit only one copy.

## Safe use

- The repository pins Supabase CLI `2.116.0` and commits an unlinked `supabase/config.toml`. Use only `npm run verify:supabase:local`, which refuses a hosted link and resets local Postgres twice. See `docs/SUPABASE_LOCAL_TESTING.md`. Tooling being present is not evidence that Docker execution or hosted RLS proof passed.
- Use this chain first in a fresh local database or a dedicated test Supabase project containing synthetic data only.
- Keep `EMPLOYEE_LIFECYCLE_ENABLED`, `AUDIT_LOG_ENABLED`, `WORKSPACE_SAFETY_ENABLED`, `TEAM_MANAGEMENT_ENABLED`, `EMPLOYEE_VERSION_HISTORY_ENABLED`, `KNOWLEDGE_V0_ENABLED`, `WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED`, and outbound flags false throughout migration and verification.
- For an existing-data target, record a verified backup and pre-migration row counts before applying anything. The cutover is deliberately one-time and fail-closed; never rerun it after shared-workspace data exists.
- If a target already received any SQL manually, stop and reconcile its schema and Supabase migration-history table before using this chain. Do not blindly mark versions applied and do not let `db push` replay equivalent policy creation.
- Never link the CLI to production as part of local validation. Applying to any hosted target, repairing migration history, restoring a backup, or enabling flags is a separate approved operation.

The chain being present in Git is not evidence that it has run successfully. Record fresh-reset, upgrade, RLS, role, backup, and restore results with `docs/SUPABASE_MIGRATION_EVIDENCE.md`.
