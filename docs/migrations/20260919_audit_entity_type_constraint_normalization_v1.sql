-- Audit event entity_type allow-list consolidation.
--
-- Root cause: 20260824000700 created audit_events with the CHECK
-- "audit_events_entity_type_check" listing only ai_employee/workspace/integration.
-- 20260905140000 later added "audit_events_entity_type_new_check" allowing
-- message and issue_report but never dropped the stale constraint, so Postgres
-- enforced BOTH allow-lists and the 'issue_report' audit rows written by the
-- guarded create_issue_report RPC were rejected.
--
-- This migration removes the stale three-value constraint and fails closed
-- unless exactly one validated entity_type allow-list constraint remains with
-- the reviewed five-value list (ai_employee, workspace, integration, message,
-- issue_report). It never weakens RLS, grants, RPC auth, audit immutability, or
-- outbound safety, and it does not rewrite, insert, or delete any data.
--
-- Idempotent: if the stale constraint has already been removed, the preflight
-- and postflight invariants still hold and the migration is a safe no-op.
--
-- Rollback: this restores the package's intended single-constraint state; do not
-- re-add the stale three-value CHECK on a data-bearing target. Recover via the
-- recorded backup if the overlapping state must ever be reproduced.
begin;

do $$
declare
  expected_five text := 'CHECK ((entity_type = ANY (ARRAY[''ai_employee''::text, ''workspace''::text, ''integration''::text, ''message''::text, ''issue_report''::text])))';
  stale_three text := 'CHECK ((entity_type = ANY (ARRAY[''ai_employee''::text, ''workspace''::text, ''integration''::text])))';
  rls_enabled boolean;
  n_entity_checks int;
  other_def text;
begin
  -- Fail closed: the audit ledger must stay RLS-protected.
  select relrowsecurity into rls_enabled
    from pg_class where oid = 'public.audit_events'::regclass;
  if rls_enabled is not true then
    raise exception 'refusing to normalize: audit_events row level security is not enabled';
  end if;

  -- Fail closed: the superseding five-value constraint must exist, be validated,
  -- and match the reviewed allow-list exactly.
  if not exists (
    select 1
      from pg_constraint c
     where c.conrelid = 'public.audit_events'::regclass
       and c.contype = 'c'
       and c.conname = 'audit_events_entity_type_new_check'
       and c.convalidated
       and pg_get_constraintdef(c.oid) = expected_five
  ) then
    raise exception 'refusing to normalize: superseding audit_events_entity_type_new_check is missing or does not match the reviewed five-value allow-list';
  end if;

  -- Fail closed: every entity_type CHECK on the table must be either the
  -- superseding five-value constraint or the known stale three-value one.
  select count(*) into n_entity_checks
    from pg_constraint c
   where c.conrelid = 'public.audit_events'::regclass
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%entity_type%';

  if n_entity_checks not in (1, 2) then
    raise exception 'refusing to normalize: unexpected number of entity_type check constraints (%)', n_entity_checks;
  end if;

  if n_entity_checks = 2 then
    select pg_get_constraintdef(c.oid) into other_def
      from pg_constraint c
     where c.conrelid = 'public.audit_events'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) like '%entity_type%'
       and c.conname <> 'audit_events_entity_type_new_check';
    if other_def is distinct from stale_three then
      raise exception 'refusing to normalize: unexpected overlapping entity_type constraint (%)', other_def;
    end if;
  end if;

  -- Remove the stale constraint. When it is already gone (idempotent rerun) this
  -- is a safe no-op because the postflight invariants still hold.
  alter table public.audit_events
    drop constraint if exists audit_events_entity_type_check;
end $$;

do $$
declare
  expected_five text := 'CHECK ((entity_type = ANY (ARRAY[''ai_employee''::text, ''workspace''::text, ''integration''::text, ''message''::text, ''issue_report''::text])))';
begin
  -- Post-normalization invariant: exactly one validated entity_type CHECK, the
  -- reviewed five-value allow-list, and no legacy constraint may remain.
  if not exists (
    select 1
      from pg_constraint c
     where c.conrelid = 'public.audit_events'::regclass
       and c.contype = 'c'
       and c.conname = 'audit_events_entity_type_new_check'
       and c.convalidated
       and pg_get_constraintdef(c.oid) = expected_five
  ) then
    raise exception 'post-normalization invariant failed: audit_events_entity_type_new_check is missing or does not match the reviewed five-value allow-list';
  end if;

  if exists (
    select 1
      from pg_constraint c
     where c.conrelid = 'public.audit_events'::regclass
       and c.contype = 'c'
       and conname <> 'audit_events_entity_type_new_check'
       and pg_get_constraintdef(c.oid) like '%entity_type%'
  ) then
    raise exception 'post-normalization invariant failed: a legacy or unexpected entity_type constraint remains';
  end if;
end $$;

commit;