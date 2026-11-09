-- Phase B milestone B4: planning & orchestration (additive only).
--
-- This migration adds the plan tables, plan step tables, plan checkpoint
-- audit table, and the SECURITY DEFINER RPCs that are the only mutation
-- paths. It does not alter any existing table, policy, grant, trigger, or
-- function.
--
-- The appointment approval queues (appointments, appointment_review_requests,
-- appointment_review_decisions, appointment_booking_approvals,
-- appointment_booking_attempts, pending_appointment_review_inbox) are not
-- touched.
--
-- Nothing here calls a model provider, WhatsApp, OAuth, the network, a
-- browser, the filesystem, or any calendar API. The tables are inert until
-- the planning engine feature flag is explicitly enabled outside production.
begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.agent_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  status text not null,
  step_cap integer not null,
  steps_completed integer not null,
  context_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint agent_plans_status_check check (
    status in ('draft', 'approved', 'executing', 'completed', 'failed', 'cancelled')
  ),
  constraint agent_plans_step_cap_check check (step_cap between 1 and 25),
  constraint agent_plans_steps_completed_check check (
    steps_completed between 0 and step_cap
  ),
  constraint agent_plans_context_hash_check check (
    context_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_plans_workspace_task_key unique (workspace_id, task_id),
  constraint agent_plans_workspace_id_id_key unique (workspace_id, id)
);

create table if not exists public.agent_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.agent_plans(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  seq integer not null,
  tool_name text not null,
  tool_version text not null,
  tool_family text not null,
  declared_tier text not null,
  risk_score jsonb,
  status text not null,
  attempts integer not null,
  max_attempts integer not null,
  timeout_ms integer not null,
  inputs_hash text not null,
  outputs_hash text,
  error_class text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_plan_steps_declared_tier_check check (
    declared_tier in ('T0', 'T1', 'T2', 'T3', 'T4', 'T5')
  ),
  constraint agent_plan_steps_status_check check (
    status in ('pending', 'running', 'succeeded', 'failed', 'skipped', 'cancelled')
  ),
  constraint agent_plan_steps_attempts_check check (attempts between 1 and max_attempts),
  constraint agent_plan_steps_max_attempts_check check (max_attempts between 1 and 3),
  constraint agent_plan_steps_timeout_ms_check check (timeout_ms between 1 and 600000),
  constraint agent_plan_steps_inputs_hash_check check (
    inputs_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_plan_steps_outputs_hash_check check (
    outputs_hash is null or outputs_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_plan_steps_error_class_check check (
    error_class is null
    or error_class in ('VALIDATION', 'PERMISSION', 'RATE_LIMIT', 'TIMEOUT', 'UPSTREAM', 'INTERNAL')
  ),
  constraint agent_plan_steps_plan_seq_key unique (plan_id, seq),
  constraint agent_plan_steps_workspace_id_id_key unique (workspace_id, id)
);

create table if not exists public.agent_plan_checkpoints (
  id uuid primary key default gen_random_uuid(),
  plan_step_id uuid not null references public.agent_plan_steps(id) on delete cascade,
  checkpoint_type text not null,
  decision text not null,
  decision_hash text not null,
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users(id) on delete set null,
  constraint agent_plan_checkpoints_checkpoint_type_check check (
    checkpoint_type in ('pre_execution', 'post_execution')
  ),
  constraint agent_plan_checkpoints_decision_check check (
    decision in ('ALLOW', 'CHALLENGE', 'DENY')
  ),
  constraint agent_plan_checkpoints_decision_hash_check check (
    decision_hash ~ '^[0-9a-f]{64}$'
  )
);

create index if not exists agent_plans_workspace_idx
  on public.agent_plans (workspace_id, created_at desc);

create index if not exists agent_plan_steps_plan_idx
  on public.agent_plan_steps (plan_id, seq);

create index if not exists agent_plan_checkpoints_step_idx
  on public.agent_plan_checkpoints (plan_step_id, checked_at desc);

-- ---------------------------------------------------------------------------
-- 2. Row-level security: authenticated reads only, workspace-scoped.
--    No client INSERT/UPDATE/DELETE policies on any of these tables.
-- ---------------------------------------------------------------------------

alter table public.agent_plans enable row level security;
alter table public.agent_plan_steps enable row level security;
alter table public.agent_plan_checkpoints enable row level security;

drop policy if exists "Agent plans are readable by workspace members"
  on public.agent_plans;
create policy "Agent plans are readable by workspace members"
  on public.agent_plans for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Agent plan steps are readable by workspace members"
  on public.agent_plan_steps;
create policy "Agent plan steps are readable by workspace members"
  on public.agent_plan_steps for select to authenticated
  using (public.is_workspace_member(
    select workspace_id from public.agent_plans where id = plan_id
  ));

drop policy if exists "Agent plan checkpoints are readable by workspace members"
  on public.agent_plan_checkpoints;
create policy "Agent plan checkpoints are readable by workspace members"
  on public.agent_plan_checkpoints for select to authenticated
  using (public.is_workspace_member(
    select p.workspace_id
    from public.agent_plans p
    join public.agent_plan_steps s on s.plan_id = p.id
    where s.id = plan_step_id
  ));

-- ---------------------------------------------------------------------------
-- 3. Append-only audit tables
-- ---------------------------------------------------------------------------

create or replace function public.prevent_agent_plan_checkpoint_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Agent plan checkpoints are append-only';
end;
$$;

revoke all on function public.prevent_agent_plan_checkpoint_mutation()
  from public, anon, authenticated;

drop trigger if exists prevent_agent_plan_checkpoint_update
  on public.agent_plan_checkpoints;
create trigger prevent_agent_plan_checkpoint_update
  before update or delete on public.agent_plan_checkpoints
  for each row execute function public.prevent_agent_plan_checkpoint_mutation();

create or replace function public.prevent_agent_plan_step_terminal_regression()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is not distinct from new.status then return new; end if;
  if old.status in ('succeeded', 'failed', 'skipped', 'cancelled')
     and new.status not in ('succeeded', 'failed', 'skipped', 'cancelled') then
    raise exception 'Agent plan step terminal status cannot be regressed';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_agent_plan_step_terminal_regression()
  from public, anon, authenticated;

drop trigger if exists prevent_agent_plan_step_regression
  on public.agent_plan_steps;
create trigger prevent_agent_plan_step_regression
  before update on public.agent_plan_steps
  for each row execute function public.prevent_agent_plan_step_terminal_regression();

-- ---------------------------------------------------------------------------
-- 4. Self-grant prohibition at the DB layer
-- ---------------------------------------------------------------------------
-- The nexa_planner_orchestrator role receives SELECT only on plan,
-- step, and checkpoint tables (no INSERT/UPDATE/DELETE). Authenticated
-- users receive SELECT only via RLS; there are no insert/update/delete
-- policies or table grants. All mutations go through the reviewed
-- SECURITY DEFINER RPCs below, which check workspace owner/admin role.
-- Direct writes from clients are therefore impossible.

-- ---------------------------------------------------------------------------
-- 5. Reviewed mutation RPCs (owner/admin only through SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_agent_plan(
  p_workspace_id uuid,
  p_task_id uuid,
  p_status text,
  p_step_cap integer,
  p_steps_completed integer default 0,
  p_context_hash text
)
returns table (reason text, plan_id uuid)
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

  if p_task_id is null
     or not exists (select 1 from public.agent_tasks where id = p_task_id) then
    return query select 'task_not_found'::text, null::uuid;
    return;
  end if;

  if p_status is null
     or p_status not in ('draft','approved','executing','completed','failed','cancelled') then
    return query select 'invalid_status'::text, null::uuid;
    return;
  end if;

  if p_step_cap is null or p_step_cap not between 1 and 25 then
    return query select 'invalid_step_cap'::text, null::uuid;
    return;
  end if;

  if p_steps_completed is null
     or p_steps_completed < 0
     or p_steps_completed > p_step_cap then
    return query select 'invalid_steps_completed'::text, null::uuid;
    return;
  end if;

  if p_context_hash is null
     or p_context_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_context_hash'::text, null::uuid;
    return;
  end if;

  insert into public.agent_plans (
    workspace_id, task_id, status, step_cap, steps_completed, context_hash
  )
  values (
    p_workspace_id, p_task_id, p_status, p_step_cap, p_steps_completed, p_context_hash
  )
  on conflict (workspace_id, task_id) do update
  set status = excluded.status,
      step_cap = excluded.step_cap,
      steps_completed = excluded.steps_completed,
      context_hash = excluded.context_hash,
      updated_at = now()
  returning id into inserted_id;

  return query select 'upserted'::text, inserted_id;
end;
$$;

create or replace function public.update_agent_plan_progress(
  p_workspace_id uuid,
  p_plan_id uuid,
  p_steps_completed integer
)
returns table (reason text, plan_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if auth.uid() is null then
    return query select 'authentication_required'::text, null::uuid;
    return;
  end if;

  select workspace_id into target_workspace_id
  from public.agent_plans
  where id = p_plan_id;

  if target_workspace_id is null then
    return query select 'plan_not_found'::text, null::uuid;
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

  if p_steps_completed is null or p_steps_completed < 0 then
    return query select 'invalid_steps_completed'::text, null::uuid;
    return;
  end if;

  update public.agent_plans
  set steps_completed = p_steps_completed,
      updated_at = now()
  where id = p_plan_id
    and steps_completed <= p_steps_completed;

  return query select 'updated'::text, p_plan_id;
end;
$$;

create or replace function public.cancel_agent_plan(
  p_workspace_id uuid,
  p_plan_id uuid
)
returns table (reason text, plan_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if auth.uid() is null then
    return query select 'authentication_required'::text, null::uuid;
    return;
  end if;

  select workspace_id into target_workspace_id
  from public.agent_plans
  where id = p_plan_id;

  if target_workspace_id is null then
    return query select 'plan_not_found'::text, null::uuid;
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

  update public.agent_plans
  set status = 'cancelled',
      updated_at = now()
  where id = p_plan_id
    and status not in ('completed', 'failed', 'cancelled');

  return query select 'cancelled'::text, p_plan_id;
end;
$$;

create or replace function public.record_agent_plan_step(
  p_workspace_id uuid,
  p_plan_id uuid,
  p_seq integer,
  p_tool_name text,
  p_tool_version text,
  p_tool_family text,
  p_declared_tier text,
  p_risk_score jsonb,
  p_status text,
  p_attempts integer,
  p_max_attempts integer,
  p_timeout_ms integer,
  p_inputs_hash text,
  p_outputs_hash text default null,
  p_error_class text default null,
  p_started_at timestamptz default null,
  p_completed_at timestamptz default null
)
returns table (reason text, step_id uuid)
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
  from public.agent_plans
  where id = p_plan_id;

  if target_workspace_id is null then
    return query select 'plan_not_found'::text, null::uuid;
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

  if p_seq is null or p_seq < 1 then
    return query select 'invalid_seq'::text, null::uuid;
    return;
  end if;

  if p_tool_name is null
     or p_tool_name !~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$' then
    return query select 'invalid_tool_name'::text, null::uuid;
    return;
  end if;

  if p_tool_version is null
     or p_tool_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    return query select 'invalid_tool_version'::text, null::uuid;
    return;
  end if;

  if p_tool_family is null
     or p_tool_family !~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$' then
    return query select 'invalid_tool_family'::text, null::uuid;
    return;
  end if;

  if p_declared_tier is null
     or p_declared_tier not in ('T0','T1','T2','T3','T4','T5') then
    return query select 'invalid_declared_tier'::text, null::uuid;
    return;
  end if;

  if p_status is null
     or p_status not in ('pending','running','succeeded','failed','skipped','cancelled') then
    return query select 'invalid_status'::text, null::uuid;
    return;
  end if;

  if p_attempts is null or p_attempts < 1
     or p_max_attempts is null or p_max_attempts not between 1 and 3
     or p_attempts > p_max_attempts then
    return query select 'invalid_attempts'::text, null::uuid;
    return;
  end if;

  if p_timeout_ms is null or p_timeout_ms not between 1 and 600000 then
    return query select 'invalid_timeout_ms'::text, null::uuid;
    return;
  end if;

  if p_inputs_hash is null
     or p_inputs_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_inputs_hash'::text, null::uuid;
    return;
  end if;

  if p_outputs_hash is not null
     and p_outputs_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_outputs_hash'::text, null::uuid;
    return;
  end if;

  if p_error_class is not null
     and p_error_class not in ('VALIDATION','PERMISSION','RATE_LIMIT','TIMEOUT','UPSTREAM','INTERNAL') then
    return query select 'invalid_error_class'::text, null::uuid;
    return;
  end if;

  insert into public.agent_plan_steps (
    plan_id, workspace_id, seq, tool_name, tool_version, tool_family, declared_tier,
    risk_score, status, attempts, max_attempts, timeout_ms,
    inputs_hash, outputs_hash, error_class, started_at, completed_at
  )
  values (
    p_plan_id, p_workspace_id, p_seq, p_tool_name, p_tool_version, p_tool_family, p_declared_tier,
    p_risk_score, p_status, p_attempts, p_max_attempts, p_timeout_ms,
    p_inputs_hash, p_outputs_hash, p_error_class, p_started_at, p_completed_at
  )
  on conflict (plan_id, seq) do update
  set tool_name = excluded.tool_name,
      tool_version = excluded.tool_version,
      tool_family = excluded.tool_family,
      declared_tier = excluded.declared_tier,
      risk_score = excluded.risk_score,
      status = excluded.status,
      attempts = excluded.attempts,
      max_attempts = excluded.max_attempts,
      timeout_ms = excluded.timeout_ms,
      inputs_hash = excluded.inputs_hash,
      outputs_hash = excluded.outputs_hash,
      error_class = excluded.error_class,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      workspace_id = excluded.workspace_id,
      updated_at = now()
  returning id into inserted_id;

  return query select 'recorded'::text, inserted_id;
end;
$$;

create or replace function public.record_agent_plan_checkpoint(
  p_workspace_id uuid,
  p_plan_step_id uuid,
  p_checkpoint_type text,
  p_decision text,
  p_decision_hash text
)
returns table (reason text, checkpoint_id uuid)
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

  select p.workspace_id into target_workspace_id
  from public.agent_plan_steps s
  join public.agent_plans p on p.id = s.plan_id
  where s.id = p_plan_step_id;

  if target_workspace_id is null then
    return query select 'plan_step_not_found'::text, null::uuid;
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

  if p_checkpoint_type is null
     or p_checkpoint_type not in ('pre_execution','post_execution') then
    return query select 'invalid_checkpoint_type'::text, null::uuid;
    return;
  end if;

  if p_decision is null
     or p_decision not in ('ALLOW','CHALLENGE','DENY') then
    return query select 'invalid_decision'::text, null::uuid;
    return;
  end if;

  if p_decision_hash is null
     or p_decision_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_decision_hash'::text, null::uuid;
    return;
  end if;

  insert into public.agent_plan_checkpoints (
    plan_step_id, checkpoint_type, decision, decision_hash
  )
  values (
    p_plan_step_id, p_checkpoint_type, p_decision, p_decision_hash
  )
  returning id into inserted_id;

  return query select 'recorded'::text, inserted_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Least-privilege grants
-- ---------------------------------------------------------------------------

revoke all privileges on table
  public.agent_plans,
  public.agent_plan_steps,
  public.agent_plan_checkpoints
from public, anon, authenticated;

grant select on table
  public.agent_plans,
  public.agent_plan_steps,
  public.agent_plan_checkpoints
to authenticated;

grant select on table
  public.agent_plans,
  public.agent_plan_steps,
  public.agent_plan_checkpoints
to service_role;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'nexa_planner_orchestrator'
  ) then
    create role nexa_planner_orchestrator nologin noinherit nobypassrls;
  end if;
end;
$$;

grant usage on schema public to nexa_planner_orchestrator;

grant select on table
  public.agent_plans,
  public.agent_plan_steps,
  public.agent_plan_checkpoints
to nexa_planner_orchestrator;

revoke all on function public.prevent_agent_plan_checkpoint_mutation()
  from public, anon, authenticated;
revoke all on function public.prevent_agent_plan_step_terminal_regression()
  from public, anon, authenticated;
revoke all on function public.upsert_agent_plan(uuid, uuid, text, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.update_agent_plan_progress(uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.cancel_agent_plan(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.record_agent_plan_step(
  uuid, uuid, integer, text, text, text, text, jsonb, text, integer, integer, integer, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.record_agent_plan_checkpoint(uuid, uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.upsert_agent_plan(uuid, uuid, text, integer, integer, text)
  to service_role;
grant execute on function public.update_agent_plan_progress(uuid, uuid, integer)
  to service_role;
grant execute on function public.cancel_agent_plan(uuid, uuid)
  to service_role;
grant execute on function public.record_agent_plan_step(
  uuid, uuid, integer, text, text, text, text, jsonb, text, integer, integer, integer, text, text, text, timestamptz, timestamptz
) to service_role;
grant execute on function public.record_agent_plan_checkpoint(uuid, uuid, text, text, text)
  to service_role;

-- Rollback guidance: the engine flag off leaves every plan blocked; additive
-- tables remain and no existing table, policy, grant, trigger, or function
-- is altered. Drop the RPCs and triggers before restoring any direct write
-- path.

commit;
