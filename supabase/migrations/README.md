# Nexa Supabase migration chain

This directory is the canonical executable migration chain for a fresh or isolated Nexa Supabase environment. Supabase applies the `.sql` files by their unique 14-digit version prefix; the exact reviewed order is:

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

`lib/workspaceMigrations.test.ts` fails if a migration is missing, renamed, reordered, duplicated, or differs from its reviewed source. Change the reviewed source and packaged migration together, with a security review; never edit only one copy.

## Safe use

- Use this chain first in a fresh local database or a dedicated test Supabase project containing synthetic data only.
- Keep `EMPLOYEE_LIFECYCLE_ENABLED`, `AUDIT_LOG_ENABLED`, `WORKSPACE_SAFETY_ENABLED`, `TEAM_MANAGEMENT_ENABLED`, and outbound flags false throughout migration and verification.
- For an existing-data target, record a verified backup and pre-migration row counts before applying anything. The cutover is deliberately one-time and fail-closed; never rerun it after shared-workspace data exists.
- If a target already received any SQL manually, stop and reconcile its schema and Supabase migration-history table before using this chain. Do not blindly mark versions applied and do not let `db push` replay equivalent policy creation.
- Never link the CLI to production as part of local validation. Applying to any hosted target, repairing migration history, restoring a backup, or enabling flags is a separate approved operation.

The chain being present in Git is not evidence that it has run successfully. Record fresh-reset, upgrade, RLS, role, backup, and restore results with `docs/SUPABASE_MIGRATION_EVIDENCE.md`.
