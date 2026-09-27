# Staging schema and migration-history comparison

Observed 2026-09-28 IST (2026-09-27 UTC), against staging project `vbizuxxgjlwqotuegskq`. Repository baseline: `c2b212073a92a565817ece24e25ab531b88c18ab`. All hosted checks were read-only catalog queries or aggregate counts through the connected Supabase service. No token values, credentials, customer rows, DDL, or migration-history writes were involved.

## Migration history

The repository contains 25 SQL migrations. Staging records 26 migrations: the first 23 canonical versions match, two later canonical versions are absent, and three staging-only versions are present.

| Canonical version absent from staging history | Observed schema state |
| --- | --- |
| `20260919120000_audit_entity_type_constraint_normalization_v1` | `audit_events` has RLS enabled and exactly one entity-type CHECK: validated `audit_events_entity_type_new_check`, allowing `ai_employee`, `workspace`, `integration`, `message`, `issue_report`. This matches the canonical migration's final invariant; it does not prove that migration ran. |
| `20260927000000_calendar_oauth_connections` | The table exists and its inspected columns, constraints, grants and policy match the packaged SQL described below. The owner reported applying this through the dashboard. |

Staging-only recorded versions:

- `20260924172517_appointment_review_queue_staging_v1`
- `20260924180931_appointment_human_decision_staging_v1`
- `20260924182505_staging_audit_four_value_constraint_bridge_v1`

This comparison does not establish complete schema parity: the booking ledger and pending inbox view also have separately documented dashboard application history. A fresh replay and explicit disposition of all staging-only objects remain required before claiming a reproducible release.

## Calendar OAuth catalog evidence

`public.calendar_oauth_connections` has RLS enabled and the 11 expected columns in order: `id`, `workspace_id`, `provider`, `calendar_id`, `access_token_encrypted`, `refresh_token_encrypted`, `scopes`, `token_expires_at`, `connected_by_user_id`, `connected_at`, `updated_at`.

Types, nullability and defaults match `supabase/migrations/20260927000000_calendar_oauth_connections.sql`. In particular, `calendar_id` is nullable and has no default; the token columns are non-null text. The observed constraints are the ID primary key, unique workspace, workspace foreign key with cascade deletion, connecting-user foreign key with restrict deletion, fixed provider check and calendar-ID length check.

Exactly one table policy was observed: `Owners and admins read workspace calendar connection`, SELECT for `authenticated`, requiring a non-null `auth.uid()` and `workspace_has_role(workspace_id, array['owner','admin'])`. The inspected direct table grants give `authenticated` SELECT only, no grants to `anon`, and full table privileges to `service_role`. This is catalog evidence, not a newly executed authenticated RLS isolation test. Table SELECT grants include encrypted token columns; the application's sanitized status projection excludes them, but encryption must not be described as column-level access denial.

The aggregate connection check returned `connection_count=0`, `configured_calendar_count=0`, and `primary_alias_count=0`. It inspected no token or calendar-ID values. This proves no saved OAuth connection at observation time, not completion of OAuth setup.

## Read-only checks used

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='calendar_oauth_connections';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='calendar_oauth_connections'
  and grantee in ('anon','authenticated','service_role')
order by grantee, privilege_type;

select count(*) as connection_count,
  count(*) filter (where calendar_id is not null) as configured_calendar_count,
  count(*) filter (where lower(trim(calendar_id))='primary') as primary_alias_count
from public.calendar_oauth_connections;
```

Columns/defaults were inspected using `pg_attribute`/`pg_attrdef`; constraints using `pg_constraint` and `pg_get_constraintdef`; migration versions using the connected migration-list operation.

## Remaining execution boundary

Do not rerun the Calendar CREATE TABLE SQL against the existing staging table. Do not mark migration history applied solely from this partial comparison. The authorized production/provider executor must first reconcile the full staging history and replay plan, then perform only separately approved hosted changes. Codex can review the plan and verify the resulting evidence. Production OAuth activation, Google consent, calendar events and outbound remain outside this read-only verification.
