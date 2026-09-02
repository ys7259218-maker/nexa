# Phase 1 reviewed migration sources and rollout gates

The SQL files in this directory remain the reviewed source for migrations 4–14, but this directory is not the executable Supabase migration layout and its old date-only names do not define a safe order. The canonical, uniquely ordered chain is `supabase/migrations/*.sql`; see `supabase/migrations/README.md` for its manifest. Static tests require every packaged migration file to remain identical to its reviewed source here.

The canonical sequence is:

1. `20260824000100_baseline_ai_employees.sql`
2. `20260824000200_settings_dashboard.sql`
3. `20260824000300_whatsapp_messaging.sql`
4. `20260824000400_workspace_tenancy_foundation.sql`
5. `20260824000500_workspace_tenancy_cutover.sql`
6. `20260824000600_employee_lifecycle.sql`
7. `20260824000700_audit_events.sql`
8. `20260824000800_workspace_kill_switch.sql`
9. `20260824000900_team_role_management.sql`
10. `20260824001000_employee_versions.sql`
11. `20260824001100_knowledge_v0.sql`
12. `20260827183015_whatsapp_channel_assignment.sql`
13. `20260829072333_conversation_safety_controls.sql`
14. `20260829143000_knowledge_source_registry_v1.sql`
15. `20260829162004_knowledge_source_freshness_v1.sql`
16. `20260830234111_privacy_safe_issue_reporting_v1.sql`

These migrations are rollout-gated. Do not apply them directly to production. For any existing-data target, back up the database and record the backup identifier before applying the chain. Keep `EMPLOYEE_LIFECYCLE_ENABLED`, `AUDIT_LOG_ENABLED`, `WORKSPACE_SAFETY_ENABLED`, `TEAM_MANAGEMENT_ENABLED`, `EMPLOYEE_VERSION_HISTORY_ENABLED`, `KNOWLEDGE_V0_ENABLED`, `KNOWLEDGE_SOURCE_REGISTRY_ENABLED`, `WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED`, `CONVERSATION_SAFETY_ENABLED`, and `ISSUE_REPORTING_ENABLED` false during migration. False/missing workspace safety or channel assignment intentionally prevents AI drafts. The source registry and issue reporting remain disabled until dedicated multi-role and cross-workspace tests pass.

The workspace foundation establishes one explicit creator-owned, owner-only personal workspace per account; ambiguity aborts instead of guessing. The cutover is one-time: it maps legacy rows through that personal identity and must not be rerun after shared-workspace data exists. If equivalent SQL was applied manually before this chain existed, stop and reconcile both schema and Supabase migration history rather than blindly replaying policy creation or marking versions applied.

Before enabling any flag, prove both a fresh install and an existing synthetic-data upgrade in a dedicated Supabase test project. Reconcile row counts, run two authenticated accounts through tenant-isolation and role tests, verify unsafe lifecycle inserts/direct updates fail, verify the guarded RPC role matrix, confirm audit rows cannot be changed/deleted, and test concurrent final-owner demotion. Activation remains locked until a trusted server verifier can write fresh `ai_employee_activation_evidence`; browser clients must never receive that write capability.

Record evidence in `docs/SUPABASE_MIGRATION_EVIDENCE.md`. Repository files alone do not prove a live reset, hosted migration, RLS boundary, backup, or restore.

Rollback begins by disabling flags and pausing every workspace. Do not run destructive down-migrations blindly; use the migration-specific rollback notes and the recorded backup.

The foundation migration is additive and keeps existing workspace/member data. If it must be rolled back before step 4, remove only its signup trigger, bootstrap function, and two SELECT policies; retain the tables and rows. After step 4, those objects are dependencies and rollback must follow the later migration notes or restore the recorded backup.
