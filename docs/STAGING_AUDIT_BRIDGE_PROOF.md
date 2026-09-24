# Staging audit constraint bridge — verified

Date: 2026-09-24. Target: **nexa-staging-test** (`vbizuxxgjlwqotuegskq`) only. Production (`nkxhlugrprdtqyqcahfx`) was read-only inspected and **not changed**.

## Root cause and change

The canonical `20260919120000_audit_entity_type_constraint_normalization_v1` expects a specific legacy three-value audit CHECK, while staging actually carried a different validated **four-value** legacy CHECK (ai_employee/workspace/integration/issue_report) together with the validated five-value CHECK (also permitting message). Production already carried only the validated five-value CHECK. Applying the canonical migration unchanged to staging would fail its strict preflight.

A reviewed **staging-only** migration, `20260924182505_staging_audit_four_value_constraint_bridge_v1`, first checked RLS, exactly two CHECK constraints, both validation flags and the exact expected four- and five-value definitions. It then dropped **only the known stale four-value constraint** inside one transaction, preserving the validated five-value constraint. No audit rows, RLS rules, grants, functions, booked appointments or messaging settings were changed.

SQL snapshot: `docs/staging-applied/20260924182505_staging_audit_four_value_constraint_bridge_v1.sql`. This is intentionally **not** in `supabase/migrations/` and must **never** be replayed against production.

## Postflight

Read-only catalog check after migration: audit_events RLS **true**, exactly **one** entity_type CHECK, and its definition matches production's five-value allow-list (ai_employee/workspace/integration/message/issue_report). Pending appointment-review queue: **0 rows**; human decision ledger: **0 rows**.

**Migration history is still divergent:** production records canonical `20260919120000_audit_entity_type_constraint_normalization_v1` and does not record staging's appointment-review experiments or this bridge. Staging records its experimental migrations and this bridge but not the canonical 20260919 version. Do not mark missing migration as applied or assume production deploy readiness. Before merging/deploying, reconcile canonical migration provenance and verify a clean fresh-database replay of the entire sequence.

The staging appointment-review route remains disabled by default; no real authenticated HTTP, booking, outbound messaging or production DDL was executed.

## Canonical SQL no-op verification after staging bridge

Fetched the **exact committed SQL** of `supabase/migrations/20260919120000_audit_entity_type_constraint_normalization_v1.sql` and executed it via staging `execute_sql` (not `apply_migration`) after the bridge. Its strict preflight and postflight completed without SQL error; the stale constraint was already absent, so its guarded `DROP CONSTRAINT IF EXISTS` had nothing to remove. Subsequent read-only inspection again found RLS enabled, precisely one five-value CHECK, 0 review queue rows, and 0 human-decision rows. **This did not write canonical migration history:** staging still does not record version `20260919120000` (26 migrations on staging at this checkpoint). A reviewed migration-history reconciliation and clean fresh-database replay remain release gates; do not mark it applied based solely on this SQL verification.
