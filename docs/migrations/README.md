# Phase 1 migration order

These migrations are manual and rollout-gated. Do not run this directory by filename order and do not apply it directly to production. Use the exact sequence below; the workspace foundation is a standalone migration and no SQL block needs to be copied from another document.

Required sequence:

1. Back up the database and record the backup identifier.
2. Apply the baseline, settings/dashboard, and WhatsApp messaging SQL from `docs/SUPABASE_SETUP.md` if it is not already present.
3. Apply `20260824_workspace_tenancy_foundation.sql`. It must establish one explicit creator-owned, owner-only personal workspace per account; ambiguity aborts instead of guessing.
4. Apply `20260824_workspace_tenancy_cutover.sql` once. It maps legacy rows only through that personal identity and must not be rerun after shared-workspace production data exists.
5. Apply `20260824_employee_lifecycle.sql`.
6. Apply `20260824_audit_events.sql`.
7. Apply `20260824_workspace_kill_switch.sql`.
8. Apply `20260824_team_role_management.sql`.

Keep `EMPLOYEE_LIFECYCLE_ENABLED`, `AUDIT_LOG_ENABLED`, `WORKSPACE_SAFETY_ENABLED`, and `TEAM_MANAGEMENT_ENABLED` false during migration. False/missing workspace safety intentionally prevents AI drafts.

Before enabling any flag, prove both a fresh install and an existing-data upgrade in a dedicated Supabase test project. Reconcile row counts, run two authenticated accounts through tenant-isolation and role tests, verify unsafe lifecycle inserts/direct updates fail, verify the guarded RPC role matrix, confirm audit rows cannot be changed/deleted, and test concurrent final-owner demotion. Activation remains locked until a trusted server verifier can write fresh `ai_employee_activation_evidence`; browser clients must never receive that write capability.

Rollback begins by disabling flags and pausing every workspace. Do not run destructive down-migrations blindly; use the migration-specific rollback notes and the recorded backup.

The foundation migration is additive and keeps existing workspace/member data. If it must be rolled back before step 4, remove only its signup trigger, bootstrap function, and two SELECT policies; retain the tables and rows. After step 4, those objects are dependencies and rollback must follow the later migration notes or restore the recorded backup.
