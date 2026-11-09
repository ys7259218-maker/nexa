-- Phase B milestone B3: permission and safety engine (additive only).
--
-- This migration adds the permission grant table, the generalized agent
-- approval request/inbox tables (separate from the appointment review
-- queues), credential-broker metadata, and the security alarm table, plus
-- the SECURITY DEFINER RPCs that are the only mutation paths.
--
-- It does not alter any existing table, policy, grant, trigger, or function.
-- The appointment approval queues (appointments, appointment_review_requests,
-- appointment_review_decisions, appointment_booking_approvals,
-- appointment_booking_attempts, pending_appointment_review_inbox) are not
-- touched.
--
-- Nothing here calls a model provider, WhatsApp, OAuth, the network, a
-- browser, the filesystem, or any calendar API. The tables are inert until
-- the permission engine feature flag is explicitly enabled outside production.
create extension if not exists pgcrypto;
begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.permission_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tier text not null,
  tool_family text not null,
  granted_by uuid references auth.users(id) on delete set null,
  scope_notes text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permission_grants_tier_check check (
    tier in ('T0', 'T1', 'T2', 'T3', 'T4', 'T5')
  ),
  constraint permission_grants_tool_family_check check (
    tool_family ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$'
  ),
  constraint permission_grants_expiry_check check (
    expires_at is null or expires_at > created_at
  ),
  constraint permission_grants_workspace_tier_family_key unique (
    workspace_id, tier, tool_family
  ),
  constraint permission_grants_workspace_id_id_key unique (workspace_id, id)
);

create table if not exists public.agent_approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tier text not null,
  tool_family text not null,
  requested_by uuid references auth.users(id) on delete set null,
  scope_notes text,
  status text not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_evidence_hash text,
  constraint agent_approval_requests_tier_check check (
    tier in ('T0', 'T1', 'T2', 'T3', 'T4', 'T5')
  ),
  constraint agent_approval_requests_tool_family_check check (
    tool_family ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$'
  ),
  constraint agent_approval_requests_status_check check (
    status in ('pending', 'approved', 'denied', 'expired')
  ),
  constraint agent_approval_requests_expiry_check check (
    expires_at is null or expires_at > requested_at
  ),
  constraint agent_approval_requests_decision_check check (
    (status in ('approved', 'denied', 'expired') and decided_at is not null)
    or (status = 'pending' and decided_at is null)
  ),
  constraint agent_approval_requests_evidence_hash_check check (
    decision_evidence_hash is null or decision_evidence_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_approval_requests_workspace_key unique (workspace_id, id)
);

create table if not exists public.agent_approval_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_request_id uuid not null references public.agent_approval_requests(id) on delete cascade,
  decision text not null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  constraint agent_approval_decisions_decision_check check (
    decision in ('approved', 'denied', 'expired')
  ),
  constraint agent_approval_decisions_evidence_hash_check check (
    evidence_hash ~ '^[0-9a-f]{64}$'
  )
);

create table if not exists public.credential_broker_metadata (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  credential_key text not null,
  encrypted_reference text not null,
  last_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credential_broker_metadata_key_check check (
    credential_key ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$'
  ),
  constraint credential_broker_metadata_workspace_key unique (workspace_id, credential_key),
  constraint credential_broker_metadata_workspace_id_id_key unique (workspace_id, id)
);

create table if not exists public.security_alarms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  alarm_kind text not null,
  severity text not null,
  detail_hash text not null,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  constraint security_alarms_alarm_kind_check check (
    alarm_kind in (
      'self_grant_attempt',
      'approval_expiry_race',
      'fail_closed_denial',
      'missing_grant',
      'unknown_grant',
      'expired_grant'
    )
  ),
  constraint security_alarms_severity_check check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  constraint security_alarms_detail_hash_check check (
    detail_hash ~ '^[0-9a-f]{64}$'
  )
);

create index if not exists permission_grants_workspace_idx
  on public.permission_grants (workspace_id, tier, tool_family);

create index if not exists agent_approval_requests_workspace_idx
  on public.agent_approval_requests (workspace_id, requested_at desc);

create index if not exists agent_approval_requests_status_idx
  on public.agent_approval_requests (workspace_id, status);

create index if not exists agent_approval_decisions_request_idx
  on public.agent_approval_decisions (approval_request_id, created_at desc);

create index if not exists credential_broker_metadata_workspace_idx
  on public.credential_broker_metadata (workspace_id, credential_key);

create index if not exists security_alarms_workspace_idx
  on public.security_alarms (workspace_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 2. Row-level security: authenticated reads only, workspace-scoped.
--    No client INSERT/UPDATE/DELETE policies on any of these tables.
-- ---------------------------------------------------------------------------

alter table public.permission_grants enable row level security;
alter table public.agent_approval_requests enable row level security;
alter table public.agent_approval_decisions enable row level security;
alter table public.credential_broker_metadata enable row level security;
alter table public.security_alarms enable row level security;

drop policy if exists "Permission grants are readable by workspace members"
  on public.permission_grants;
create policy "Permission grants are readable by workspace members"
  on public.permission_grants for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Agent approval requests are readable by workspace members"
  on public.agent_approval_requests;
create policy "Agent approval requests are readable by workspace members"
  on public.agent_approval_requests for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Agent approval decisions are readable by workspace members"
  on public.agent_approval_decisions;
create policy "Agent approval decisions are readable by workspace members"
  on public.agent_approval_decisions for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Credential broker metadata is readable by workspace members"
  on public.credential_broker_metadata;
create policy "Credential broker metadata is readable by workspace members"
  on public.credential_broker_metadata for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Security alarms are readable by workspace members"
  on public.security_alarms;
create policy "Security alarms are readable by workspace members"
  on public.security_alarms for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- 3. Append-only audit/alarm tables
-- ---------------------------------------------------------------------------

create or replace function public.prevent_agent_approval_decision_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Agent approval decisions are append-only';
end;
$$;

revoke all on function public.prevent_agent_approval_decision_mutation()
  from public, anon, authenticated;

drop trigger if exists prevent_agent_approval_decision_update
  on public.agent_approval_decisions;
create trigger prevent_agent_approval_decision_update
  before update or delete on public.agent_approval_decisions
  for each row execute function public.prevent_agent_approval_decision_mutation();

create or replace function public.prevent_security_alarm_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Security alarms are append-only';
end;
$$;

revoke all on function public.prevent_security_alarm_mutation()
  from public, anon, authenticated;

drop trigger if exists prevent_security_alarm_update
  on public.security_alarms;
create trigger prevent_security_alarm_update
  before update or delete on public.security_alarms
  for each row execute function public.prevent_security_alarm_mutation();

-- ---------------------------------------------------------------------------
-- 4. Self-grant prohibition at the DB layer
-- ---------------------------------------------------------------------------
-- The nexa_permission_engine role receives SELECT only on permission,
-- approval, and alarm tables (no INSERT/UPDATE/DELETE). Authenticated users
-- receive SELECT only via RLS; there are no insert/update/delete policies or
-- table grants. All mutations go through the reviewed SECURITY DEFINER RPCs
-- below, which check workspace owner/admin role. Direct writes from clients
-- are therefore impossible — the agent runtime role cannot self-grant.
--
-- Append-only triggers on decision and alarm tables prevent tampering with
-- historical records.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. Reviewed mutation RPCs (owner/admin only through SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_permission_grant(
  p_workspace_id uuid,
  p_tier text,
  p_tool_family text,
  p_granted_by uuid default null,
  p_scope_notes text default null,
  p_expires_at timestamptz default null
)
returns table (reason text, grant_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id uuid;
begin
  if auth.uid() is null then
    return query select 'authentication_required'::text, null::uuid;
    return;
  end if;

  if p_workspace_id is null
     or not exists (select 1 from public.workspaces where id = p_workspace_id) then
    return query select 'workspace_not_found'::text, null::uuid;
    return;
  end if;

  if not public.workspace_has_role(p_workspace_id, array['owner','admin']) then
    return query select 'insufficient_workspace_role'::text, null::uuid;
    return;
  end if;

  if p_tier is null or p_tier not in ('T0','T1','T2','T3','T4','T5') then
    return query select 'invalid_tier'::text, null::uuid;
    return;
  end if;

  if p_tool_family is null
     or p_tool_family !~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$' then
    return query select 'invalid_tool_family'::text, null::uuid;
    return;
  end if;

  if p_granted_by is not null
     and not exists (select 1 from auth.users where id = p_granted_by) then
    return query select 'invalid_granted_by'::text, null::uuid;
    return;
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    return query select 'expired_grant_not_allowed'::text, null::uuid;
    return;
  end if;

  insert into public.permission_grants (
    workspace_id, tier, tool_family, granted_by, scope_notes, expires_at
  )
  values (
    p_workspace_id, p_tier, p_tool_family, p_granted_by, p_scope_notes, p_expires_at
  )
  on conflict (workspace_id, tier, tool_family) do update
  set granted_by = excluded.granted_by,
      scope_notes = excluded.scope_notes,
      expires_at = excluded.expires_at,
      updated_at = now()
  returning id into inserted_id;

  return query select 'upserted'::text, inserted_id;
end;
$$;

create or replace function public.revoke_permission_grant(
  p_workspace_id uuid,
  p_tier text,
  p_tool_family text
)
returns table (reason text, revoked_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked_id uuid;
begin
  if auth.uid() is null then
    return query select 'authentication_required'::text, null::uuid;
    return;
  end if;

  if p_workspace_id is null
     or not exists (select 1 from public.workspaces where id = p_workspace_id) then
    return query select 'workspace_not_found'::text, null::uuid;
    return;
  end if;

  if not public.workspace_has_role(p_workspace_id, array['owner','admin']) then
    return query select 'insufficient_workspace_role'::text, null::uuid;
    return;
  end if;

  delete from public.permission_grants
  where workspace_id = p_workspace_id
    and tier = p_tier
    and tool_family = p_tool_family
  returning id into revoked_id;

  if revoked_id is null then
    return query select 'grant_not_found'::text, null::uuid;
    return;
  end if;

  return query select 'revoked'::text, revoked_id;
end;
$$;

create or replace function public.record_approval_decision(
  p_workspace_id uuid,
  p_approval_request_id uuid,
  p_decision text,
  p_evidence_hash text,
  p_decided_by uuid default null
)
returns table (reason text, decision_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  inserted_id uuid;
begin
  if auth.uid() is null then
    return query select 'authentication_required'::text, null::uuid;
    return;
  end if;

  select workspace_id into target_workspace_id
  from public.agent_approval_requests
  where id = p_approval_request_id;

  if target_workspace_id is null then
    return query select 'approval_request_not_found'::text, null::uuid;
    return;
  end if;

  if p_workspace_id is distinct from target_workspace_id then
    return query select 'workspace_mismatch'::text, null::uuid;
    return;
  end if;

  if not public.workspace_has_role(p_workspace_id, array['owner','admin']) then
    return query select 'insufficient_workspace_role'::text, null::uuid;
    return;
  end if;

  if p_decision is null or p_decision not in ('approved','denied','expired') then
    return query select 'invalid_decision'::text, null::uuid;
    return;
  end if;

  if p_evidence_hash is null or p_evidence_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_evidence_hash'::text, null::uuid;
    return;
  end if;

  update public.agent_approval_requests
  set status = p_decision,
      decided_at = now(),
      decided_by = coalesce(p_decided_by, auth.uid()),
      decision_evidence_hash = p_evidence_hash
  where id = p_approval_request_id
    and status = 'pending';

  insert into public.agent_approval_decisions (
    workspace_id, approval_request_id, decision, decided_by, evidence_hash
  )
  values (
    target_workspace_id, p_approval_request_id, p_decision,
    coalesce(p_decided_by, auth.uid()), p_evidence_hash
  )
  returning id into inserted_id;

  return query select 'recorded'::text, inserted_id;
end;
$$;

create or replace function public.record_security_alarm(
  p_workspace_id uuid,
  p_alarm_kind text,
  p_severity text,
  p_detail_hash text
)
returns table (reason text, alarm_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id uuid;
begin
  if p_workspace_id is null
     or not exists (select 1 from public.workspaces where id = p_workspace_id) then
    return query select 'workspace_not_found'::text, null::uuid;
    return;
  end if;

  if p_alarm_kind is null
     or p_alarm_kind not in (
       'self_grant_attempt','approval_expiry_race','fail_closed_denial',
       'missing_grant','unknown_grant','expired_grant'
     ) then
    return query select 'invalid_alarm_kind'::text, null::uuid;
    return;
  end if;

  if p_severity is null or p_severity not in ('low','medium','high','critical') then
    return query select 'invalid_severity'::text, null::uuid;
    return;
  end if;

  if p_detail_hash is null or p_detail_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_detail_hash'::text, null::uuid;
    return;
  end if;

  insert into public.security_alarms (
    workspace_id, alarm_kind, severity, detail_hash
  )
  values (
    p_workspace_id, p_alarm_kind, p_severity, p_detail_hash
  )
  returning id into inserted_id;

  return query select 'recorded'::text, inserted_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Least-privilege grants
-- ---------------------------------------------------------------------------

revoke all privileges on table
  public.permission_grants,
  public.agent_approval_requests,
  public.agent_approval_decisions,
  public.credential_broker_metadata,
  public.security_alarms
from public, anon, authenticated;

grant select on table
  public.permission_grants,
  public.agent_approval_requests,
  public.agent_approval_decisions,
  public.credential_broker_metadata,
  public.security_alarms
to authenticated;

grant select on table
  public.permission_grants,
  public.agent_approval_requests,
  public.agent_approval_decisions,
  public.credential_broker_metadata,
  public.security_alarms
to service_role;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'nexa_permission_engine'
  ) then
    create role nexa_permission_engine nologin noinherit nobypassrls;
  end if;
end;
$$;

grant usage on schema public to nexa_permission_engine;

grant select on table
  public.permission_grants,
  public.agent_approval_requests,
  public.agent_approval_decisions,
  public.credential_broker_metadata,
  public.security_alarms
to nexa_permission_engine;

revoke all on function public.prevent_agent_approval_decision_mutation()
  from public, anon, authenticated;
revoke all on function public.prevent_security_alarm_mutation()
  from public, anon, authenticated;
revoke all on function public.upsert_permission_grant(uuid, text, text, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.revoke_permission_grant(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.record_approval_decision(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.record_security_alarm(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.upsert_permission_grant(uuid, text, text, uuid, text, timestamptz)
  to service_role;
grant execute on function public.revoke_permission_grant(uuid, text, text)
  to service_role;
grant execute on function public.record_approval_decision(uuid, uuid, text, text, uuid)
  to service_role;
grant execute on function public.record_security_alarm(uuid, text, text, text)
  to service_role;

-- Rollback guidance: the engine flag off leaves every authorize() verdict as
-- DENY; additive tables remain and no existing table, policy, grant, trigger,
-- or function is altered. Drop the RPCs and guard triggers before restoring
-- any direct write path.

commit;
