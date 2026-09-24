-- Applied ONLY to nexa-staging-test (vbizuxxgjlwqotuegskq).
-- Supabase history: 20260924182505_staging_audit_four_value_constraint_bridge_v1.
-- This is an exact staging-only migration snapshot, NOT a production migration.
-- Drop only the reviewed validated 4-value stale audit CHECK, while retaining
-- the already validated 5-value CHECK. No row/grant/RLS changes.
begin;
do $$
declare legacy_def text := 'CHECK ((entity_type = ANY (ARRAY[''ai_employee''::text, ''workspace''::text, ''integration''::text, ''issue_report''::text])))';
  full_def text := 'CHECK ((entity_type = ANY (ARRAY[''ai_employee''::text, ''workspace''::text, ''integration''::text, ''message''::text, ''issue_report''::text])))';
  actual_legacy text; actual_full text; count_checks int; protected boolean;
begin
  select relrowsecurity into protected from pg_class where oid='public.audit_events'::regclass;
  if protected is distinct from true then raise exception 'audit ledger RLS absent'; end if;
  select count(*) into count_checks from pg_constraint
    where conrelid='public.audit_events'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%entity_type%';
  if count_checks<>2 then raise exception 'unexpected entity_type constraint count %',count_checks; end if;
  select pg_get_constraintdef(oid) into actual_legacy from pg_constraint
    where conrelid='public.audit_events'::regclass and conname='audit_events_entity_type_check' and contype='c' and convalidated;
  select pg_get_constraintdef(oid) into actual_full from pg_constraint
    where conrelid='public.audit_events'::regclass and conname='audit_events_entity_type_new_check' and contype='c' and convalidated;
  if actual_legacy is distinct from legacy_def or actual_full is distinct from full_def then
    raise exception 'audit constraint definitions differ from reviewed staging bridge'; end if;
  alter table public.audit_events drop constraint audit_events_entity_type_check;
  select count(*) into count_checks from pg_constraint
    where conrelid='public.audit_events'::regclass and contype='c' and pg_get_constraintdef(oid) like '%entity_type%';
  if count_checks<>1 then raise exception 'expected exactly one entity_type CHECK after normalization'; end if;
end $$;
commit;
