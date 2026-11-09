-- Phase B milestone B1: agent runtime foundation (additive only).
--
-- This migration adds the durable session/task/step/event model, the atomic
-- lease/claim path, cooperative cancellation, the deadline watchdog, and the
-- least-privilege role matrix for the future worker process. It does not alter
-- any existing table, policy, grant, trigger, or function.
--
-- B1 executes mock steps only. Nothing here calls a model provider, WhatsApp,
-- OAuth, the network, or any business table. All runtime state is workspace
-- scoped and RLS select-only for authenticated users; writes are reachable only
-- through the reviewed SECURITY DEFINER RPCs below.
begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'console',
  model_policy text not null default 'mock',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  constraint agent_sessions_channel_check check (channel in ('console')),
  constraint agent_sessions_model_policy_check check (model_policy in ('mock')),
  constraint agent_sessions_status_check check (status in ('active', 'closed')),
  constraint agent_sessions_workspace_id_id_key unique (workspace_id, id)
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal text not null,
  state text not null default 'INTAKE',
  plan_version integer not null default 1,
  cancel_requested boolean not null default false,
  cancel_requested_at timestamptz,
  deadline_at timestamptz not null,
  max_steps integer not null default 25,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_heartbeat_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  evidence jsonb not null default '{}'::jsonb,
  constraint agent_tasks_state_check check (
    state in (
      'INTAKE', 'CLARIFY', 'PLANNING', 'AWAITING_APPROVAL', 'EXECUTING',
      'VERIFYING', 'NEEDS_USER_INPUT', 'COMPLETE', 'FAILED', 'CANCELLED'
    )
  ),
  constraint agent_tasks_goal_check check (char_length(btrim(goal)) between 1 and 2000),
  constraint agent_tasks_max_steps_check check (max_steps between 1 and 25),
  constraint agent_tasks_deadline_check check (deadline_at > created_at),
  constraint agent_tasks_lease_pair_check check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  ),
  constraint agent_tasks_cancel_pair_check check (
    (cancel_requested = false and cancel_requested_at is null)
    or (cancel_requested = true and cancel_requested_at is not null)
  ),
  constraint agent_tasks_completed_at_state_check check (
    (state in ('COMPLETE', 'FAILED', 'CANCELLED') and completed_at is not null)
    or (state not in ('COMPLETE', 'FAILED', 'CANCELLED') and completed_at is null)
  ),
  constraint agent_tasks_failure_reason_check check (
    failure_reason is null or char_length(failure_reason) between 1 and 120
  ),
  constraint agent_tasks_workspace_id_id_key unique (workspace_id, id),
  constraint agent_tasks_session_fkey
    foreign key (workspace_id, session_id)
    references public.agent_sessions(workspace_id, id)
    on delete cascade
);

create table if not exists public.agent_task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  seq integer not null,
  kind text not null default 'mock',
  label text not null,
  tool_name text not null default 'mock.echo',
  tool_version text not null default '1.0.0',
  args_hash text not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  idempotency_key text not null,
  evidence jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_task_steps_seq_check check (seq between 1 and 100),
  constraint agent_task_steps_kind_check check (kind in ('mock')),
  constraint agent_task_steps_label_check check (char_length(btrim(label)) between 1 and 200),
  constraint agent_task_steps_tool_version_check check (char_length(tool_version) between 1 and 40),
  constraint agent_task_steps_args_hash_check check (args_hash ~ '^[0-9a-f]{64}$'),
  constraint agent_task_steps_status_check check (
    status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED')
  ),
  constraint agent_task_steps_attempts_check check (attempts between 0 and 5),
  constraint agent_task_steps_idempotency_key_check check (
    char_length(idempotency_key) between 1 and 160
  ),
  constraint agent_task_steps_completed_at_status_check check (
    (status in ('SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED') and completed_at is not null)
    or (status in ('PENDING', 'RUNNING') and completed_at is null)
  ),
  constraint agent_task_steps_task_seq_key unique (task_id, seq),
  constraint agent_task_steps_task_idempotency_key unique (task_id, idempotency_key),
  constraint agent_task_steps_task_fkey
    foreign key (workspace_id, task_id)
    references public.agent_tasks(workspace_id, id)
    on delete cascade
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null,
  seq bigint not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agent_events_seq_check check (seq > 0),
  constraint agent_events_type_check check (
    type in (
      'task_created', 'task_claimed', 'task_lease_reclaimed', 'task_lease_released',
      'task_cancel_requested', 'task_cancelled', 'task_transitioned',
      'step_started', 'step_succeeded', 'step_failed', 'step_skipped', 'step_cancelled',
      'task_failed', 'task_completed'
    )
  ),
  constraint agent_events_task_seq_key unique (task_id, seq),
  constraint agent_events_task_fkey
    foreign key (workspace_id, task_id)
    references public.agent_tasks(workspace_id, id)
    on delete cascade
);

create index if not exists agent_tasks_claim_idx
  on public.agent_tasks (state, created_at)
  where lease_token is null;

create index if not exists agent_tasks_workspace_created_idx
  on public.agent_tasks (workspace_id, created_at desc);

create index if not exists agent_tasks_lease_expires_idx
  on public.agent_tasks (lease_expires_at);

create index if not exists agent_task_steps_task_seq_idx
  on public.agent_task_steps (task_id, seq);

create index if not exists agent_events_task_seq_idx
  on public.agent_events (task_id, seq);

-- ---------------------------------------------------------------------------
-- 2. Row-level security: authenticated reads only, workspace-scoped.
-- ---------------------------------------------------------------------------

alter table public.agent_sessions enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_task_steps enable row level security;
alter table public.agent_events enable row level security;

drop policy if exists "Agent sessions are readable by workspace members" on public.agent_sessions;
create policy "Agent sessions are readable by workspace members"
  on public.agent_sessions for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Agent tasks are readable by workspace members" on public.agent_tasks;
create policy "Agent tasks are readable by workspace members"
  on public.agent_tasks for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Agent task steps are readable by workspace members" on public.agent_task_steps;
create policy "Agent task steps are readable by workspace members"
  on public.agent_task_steps for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Agent events are readable by workspace members" on public.agent_events;
create policy "Agent events are readable by workspace members"
  on public.agent_events for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- 3. Append-only events
-- ---------------------------------------------------------------------------

create or replace function public.prevent_agent_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Agent events are append-only';
end;
$$;

revoke all on function public.prevent_agent_event_mutation() from public, anon, authenticated;

drop trigger if exists prevent_agent_event_update on public.agent_events;
create trigger prevent_agent_event_update
  before update on public.agent_events
  for each row execute function public.prevent_agent_event_mutation();

-- Assigns the next per-task sequence under the task row lock, so concurrent
-- writers cannot duplicate a sequence. Payloads stay content-free.
create or replace function public.append_agent_event(
  p_task_id uuid,
  p_type text,
  p_payload jsonb default '{}'::jsonb
)
returns public.agent_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.agent_tasks;
  next_seq bigint;
  inserted public.agent_events;
begin
  select * into target
  from public.agent_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'agent task not found';
  end if;

  select coalesce(max(seq), 0) + 1 into next_seq
  from public.agent_events
  where task_id = p_task_id;

  insert into public.agent_events (workspace_id, task_id, seq, type, payload)
  values (target.workspace_id, p_task_id, next_seq, p_type, coalesce(p_payload, '{}'::jsonb))
  returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.append_agent_event(uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. FSM transition allow-list (mirrored in lib/agent/fsm.ts)
-- ---------------------------------------------------------------------------

create or replace function public.agent_task_transition_allowed(
  p_from_state text,
  p_to_state text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
    from (values
      ('INTAKE', 'CLARIFY'),
      ('INTAKE', 'PLANNING'),
      ('INTAKE', 'CANCELLED'),
      ('INTAKE', 'FAILED'),
      ('CLARIFY', 'PLANNING'),
      ('CLARIFY', 'CANCELLED'),
      ('CLARIFY', 'FAILED'),
      ('PLANNING', 'AWAITING_APPROVAL'),
      ('PLANNING', 'EXECUTING'),
      ('PLANNING', 'NEEDS_USER_INPUT'),
      ('PLANNING', 'CANCELLED'),
      ('PLANNING', 'FAILED'),
      ('AWAITING_APPROVAL', 'EXECUTING'),
      ('AWAITING_APPROVAL', 'CANCELLED'),
      ('AWAITING_APPROVAL', 'FAILED'),
      ('EXECUTING', 'VERIFYING'),
      ('EXECUTING', 'AWAITING_APPROVAL'),
      ('EXECUTING', 'NEEDS_USER_INPUT'),
      ('EXECUTING', 'CANCELLED'),
      ('EXECUTING', 'FAILED'),
      ('NEEDS_USER_INPUT', 'EXECUTING'),
      ('NEEDS_USER_INPUT', 'CANCELLED'),
      ('NEEDS_USER_INPUT', 'FAILED'),
      ('VERIFYING', 'COMPLETE'),
      ('VERIFYING', 'AWAITING_APPROVAL'),
      ('VERIFYING', 'NEEDS_USER_INPUT'),
      ('VERIFYING', 'CANCELLED'),
      ('VERIFYING', 'FAILED')
    ) as allowed(from_state, to_state)
    where allowed.from_state = p_from_state
      and allowed.to_state = p_to_state
  );
$$;

revoke all on function public.agent_task_transition_allowed(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Atomic lease/claim, heartbeat, release
-- ---------------------------------------------------------------------------

create or replace function public.claim_agent_task(
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns table (
  reason text,
  task_id uuid,
  workspace_id uuid,
  state text,
  lease_token uuid,
  lease_expires_at timestamptz,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.agent_tasks;
  previous_lease uuid;
  requeued integer := 0;
  workspace_cap constant integer := 2;
  global_cap constant integer := 20;
begin
  if p_worker_id is null or char_length(btrim(p_worker_id)) not between 1 and 120 then
    return query select 'invalid_worker'::text, null::uuid, null::uuid, null::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  if p_lease_seconds is null or p_lease_seconds < 15 or p_lease_seconds > 300 then
    return query select 'invalid_lease'::text, null::uuid, null::uuid, null::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  -- Serialize claims so both caps are exact even under concurrent workers.
  perform pg_advisory_xact_lock(hashtextextended('nexa.agent.claim', 0));

  select t.* into claimed
  from public.agent_tasks t
  where t.state in (
      'INTAKE', 'CLARIFY', 'PLANNING', 'EXECUTING', 'VERIFYING', 'NEEDS_USER_INPUT'
    )
    and t.cancel_requested = false
    and t.deadline_at > now()
    and (t.lease_token is null or t.lease_expires_at <= now())
    and (
      select count(*)
      from public.agent_tasks w
      where w.workspace_id = t.workspace_id
        and w.lease_token is not null
        and w.lease_expires_at > now()
        and w.id <> t.id
    ) < workspace_cap
    and (
      select count(*)
      from public.agent_tasks g
      where g.lease_token is not null
        and g.lease_expires_at > now()
        and g.id <> t.id
    ) < global_cap
  order by t.created_at asc
  limit 1
  for update skip locked;

  if not found then
    return query select 'none'::text, null::uuid, null::uuid, null::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  previous_lease := claimed.lease_token;

  update public.agent_tasks t
  set lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_heartbeat_at = now(),
      updated_at = now()
  where t.id = claimed.id
  returning * into claimed;

  -- Crash recovery: a RUNNING step from an expired lease is safe to re-run
  -- because every step is idempotency-keyed and B1 steps are mock-only.
  update public.agent_task_steps s
  set status = 'PENDING',
      started_at = null,
      updated_at = now()
  where s.task_id = claimed.id
    and s.status = 'RUNNING';
  get diagnostics requeued = row_count;

  if previous_lease is not null then
    perform public.append_agent_event(
      claimed.id,
      'task_lease_reclaimed',
      jsonb_build_object('worker_id', p_worker_id, 'requeued_steps', requeued)
    );
  end if;

  perform public.append_agent_event(
    claimed.id,
    'task_claimed',
    jsonb_build_object('worker_id', p_worker_id)
  );

  return query select
    'claimed'::text,
    claimed.id,
    claimed.workspace_id,
    claimed.state,
    claimed.lease_token,
    claimed.lease_expires_at,
    claimed.deadline_at;
end;
$$;

create or replace function public.heartbeat_agent_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 60
)
returns table (
  reason text,
  state text,
  cancel_requested boolean,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.agent_tasks;
  new_expires timestamptz;
begin
  if p_lease_seconds is null or p_lease_seconds < 15 or p_lease_seconds > 300 then
    return query select 'invalid_lease'::text, null::text, null::boolean, null::timestamptz;
    return;
  end if;

  update public.agent_tasks t
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_heartbeat_at = now(),
      updated_at = now()
  where t.id = p_task_id
    and t.lease_token = p_lease_token
    and t.lease_expires_at > now()
  returning t.state, t.cancel_requested, t.lease_expires_at
  into target.state, target.cancel_requested, new_expires;

  if found then
    return query select 'extended'::text, target.state, target.cancel_requested, new_expires;
    return;
  end if;

  select * into target
  from public.agent_tasks
  where id = p_task_id;

  if not found then
    return query select 'not_found'::text, null::text, null::boolean, null::timestamptz;
  elsif target.lease_token is distinct from p_lease_token then
    return query select 'lease_mismatch'::text, target.state, target.cancel_requested, target.lease_expires_at;
  else
    return query select 'lease_expired'::text, target.state, target.cancel_requested, target.lease_expires_at;
  end if;
end;
$$;

create or replace function public.release_agent_task(
  p_task_id uuid,
  p_lease_token uuid
)
returns table (reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.agent_tasks;
begin
  update public.agent_tasks t
  set lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where t.id = p_task_id
    and t.lease_token = p_lease_token
  returning * into target;

  if found then
    perform public.append_agent_event(
      target.id,
      'task_lease_released',
      jsonb_build_object('state', target.state)
    );
    return query select 'released'::text;
    return;
  end if;

  select * into target
  from public.agent_tasks
  where id = p_task_id;

  if not found then
    return query select 'not_found'::text;
  elsif target.lease_token is distinct from p_lease_token then
    return query select 'lease_mismatch'::text;
  else
    return query select 'not_leased'::text;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Guarded state transitions and step recording
-- ---------------------------------------------------------------------------

create or replace function public.transition_agent_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_from_state text,
  p_to_state text,
  p_reason text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns table (reason text, state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.agent_tasks;
  terminal boolean;
begin
  if p_from_state is null or p_to_state is null
     or p_from_state not in (
       'INTAKE', 'CLARIFY', 'PLANNING', 'AWAITING_APPROVAL', 'EXECUTING',
       'VERIFYING', 'NEEDS_USER_INPUT', 'COMPLETE', 'FAILED', 'CANCELLED'
     )
     or p_to_state not in (
       'INTAKE', 'CLARIFY', 'PLANNING', 'AWAITING_APPROVAL', 'EXECUTING',
       'VERIFYING', 'NEEDS_USER_INPUT', 'COMPLETE', 'FAILED', 'CANCELLED'
     ) then
    return query select 'invalid_state'::text, null::text;
    return;
  end if;

  select * into target
  from public.agent_tasks
  where id = p_task_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if target.lease_token is distinct from p_lease_token then
    return query select 'lease_mismatch'::text, target.state;
    return;
  end if;

  if target.lease_expires_at is null or target.lease_expires_at <= now() then
    return query select 'lease_expired'::text, target.state;
    return;
  end if;

  if target.state <> p_from_state then
    return query select 'state_mismatch'::text, target.state;
    return;
  end if;

  if not public.agent_task_transition_allowed(p_from_state, p_to_state) then
    return query select 'invalid_transition'::text, target.state;
    return;
  end if;

  if target.cancel_requested and p_to_state not in ('CANCELLED', 'FAILED') then
    return query select 'cancel_requested'::text, target.state;
    return;
  end if;

  terminal := p_to_state in ('COMPLETE', 'FAILED', 'CANCELLED');

  update public.agent_tasks t
  set state = p_to_state,
      updated_at = now(),
      completed_at = case when terminal then now() else null end,
      failure_reason = case
        when p_to_state = 'FAILED' then left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 120)
        else null
      end,
      evidence = t.evidence || coalesce(p_evidence, '{}'::jsonb),
      lease_token = case when terminal then null else t.lease_token end,
      lease_expires_at = case when terminal then null else t.lease_expires_at end
  where t.id = p_task_id;

  if p_to_state = 'COMPLETE' then
    perform public.append_agent_event(
      target.id,
      'task_completed',
      jsonb_build_object('from_state', p_from_state, 'to_state', p_to_state)
    );
  elsif p_to_state = 'FAILED' then
    perform public.append_agent_event(
      target.id,
      'task_failed',
      jsonb_build_object(
        'from_state', p_from_state,
        'reason', left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 120)
      )
    );
  else
    perform public.append_agent_event(
      target.id,
      'task_transitioned',
      jsonb_build_object('from_state', p_from_state, 'to_state', p_to_state)
    );
  end if;

  return query select 'transitioned'::text, p_to_state;
end;
$$;

create or replace function public.record_agent_step(
  p_task_id uuid,
  p_lease_token uuid,
  p_step_id uuid,
  p_status text,
  p_evidence jsonb default '{}'::jsonb
)
returns table (reason text, step_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.agent_tasks;
  step public.agent_task_steps;
  event_type text;
begin
  if p_status is null
     or p_status not in ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED') then
    return query select 'invalid_status'::text, null::text;
    return;
  end if;

  select * into target
  from public.agent_tasks
  where id = p_task_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if target.lease_token is distinct from p_lease_token then
    return query select 'lease_mismatch'::text, null::text;
    return;
  end if;

  if target.lease_expires_at is null or target.lease_expires_at <= now() then
    return query select 'lease_expired'::text, null::text;
    return;
  end if;

  if target.state <> 'EXECUTING' then
    return query select 'state_mismatch'::text, null::text;
    return;
  end if;

  if target.cancel_requested and p_status not in ('FAILED', 'CANCELLED') then
    return query select 'cancel_requested'::text, null::text;
    return;
  end if;

  select * into step
  from public.agent_task_steps
  where id = p_step_id
    and task_id = p_task_id
  for update;

  if not found then
    return query select 'step_not_found'::text, null::text;
    return;
  end if;

  if step.status = 'SUCCEEDED' then
    return query select 'already_completed'::text, step.status;
    return;
  end if;

  if step.status in ('FAILED', 'SKIPPED', 'CANCELLED') then
    return query select 'step_terminal'::text, step.status;
    return;
  end if;

  if p_status = 'RUNNING' and step.attempts >= 5 then
    return query select 'attempts_exhausted'::text, step.status;
    return;
  end if;

  update public.agent_task_steps s
  set status = p_status,
      attempts = s.attempts + case when p_status = 'RUNNING' then 1 else 0 end,
      started_at = case
        when p_status = 'RUNNING' and s.started_at is null then now()
        else s.started_at
      end,
      completed_at = case
        when p_status in ('SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED') then now()
        else null
      end,
      evidence = s.evidence || coalesce(p_evidence, '{}'::jsonb),
      updated_at = now()
  where s.id = p_step_id;

  event_type := case p_status
    when 'RUNNING' then 'step_started'
    when 'SUCCEEDED' then 'step_succeeded'
    when 'FAILED' then 'step_failed'
    when 'SKIPPED' then 'step_skipped'
    else 'step_cancelled'
  end;

  perform public.append_agent_event(
    p_task_id,
    event_type,
    jsonb_build_object('step_id', p_step_id, 'seq', step.seq, 'status', p_status)
  );

  return query select 'recorded'::text, p_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Cooperative cancellation (user-facing 1-arg wrapper + service 2-arg form)
-- ---------------------------------------------------------------------------

create or replace function public.request_agent_task_cancel(
  p_task_id uuid,
  p_actor_user_id uuid
)
returns table (reason text, state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.agent_tasks;
  has_active_lease boolean;
begin
  select * into target
  from public.agent_tasks
  where id = p_task_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if p_actor_user_id is null then
    return query select 'not_authorized'::text, target.state;
    return;
  end if;

  if not (
    target.created_by = p_actor_user_id
    or public.workspace_has_role(target.workspace_id, array['owner', 'admin', 'operator'])
  ) then
    return query select 'not_authorized'::text, target.state;
    return;
  end if;

  if target.state in ('COMPLETE', 'FAILED', 'CANCELLED') then
    return query select 'terminal'::text, target.state;
    return;
  end if;

  if target.cancel_requested then
    return query select 'already_requested'::text, target.state;
    return;
  end if;

  has_active_lease := target.lease_token is not null and target.lease_expires_at > now();

  update public.agent_tasks t
  set cancel_requested = true,
      cancel_requested_at = now(),
      updated_at = now()
  where t.id = p_task_id;

  if has_active_lease then
    perform public.append_agent_event(
      target.id,
      'task_cancel_requested',
      jsonb_build_object('actor_user_id', p_actor_user_id)
    );
    return query select 'requested'::text, target.state;
    return;
  end if;

  update public.agent_tasks t
  set state = 'CANCELLED',
      completed_at = now(),
      evidence = t.evidence || jsonb_build_object('reason', 'user_requested'),
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where t.id = p_task_id;

  perform public.append_agent_event(
    target.id,
    'task_cancelled',
    jsonb_build_object('reason', 'user_requested', 'actor_user_id', p_actor_user_id)
  );

  return query select 'cancelled'::text, 'CANCELLED'::text;
end;
$$;

create or replace function public.request_agent_task_cancel(p_task_id uuid)
returns table (reason text, state text)
language sql
security definer
set search_path = ''
as $$
  select *
  from public.request_agent_task_cancel(p_task_id, (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- 8. Deadline / abandoned-cancel watchdog
-- ---------------------------------------------------------------------------

create or replace function public.reap_agent_tasks()
returns table (failed_count integer, cancelled_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.agent_tasks;
  failed integer := 0;
  cancelled integer := 0;
begin
  for target in
    select *
    from public.agent_tasks
    where state not in ('COMPLETE', 'FAILED', 'CANCELLED')
      and deadline_at <= now()
    for update skip locked
  loop
    update public.agent_tasks t
    set state = 'FAILED',
        failure_reason = 'deadline_exceeded',
        completed_at = now(),
        evidence = t.evidence || jsonb_build_object(
          'reason', 'deadline_exceeded',
          'deadline_at', target.deadline_at
        ),
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where t.id = target.id;

    perform public.append_agent_event(
      target.id,
      'task_failed',
      jsonb_build_object('reason', 'deadline_exceeded', 'deadline_at', target.deadline_at)
    );

    failed := failed + 1;
  end loop;

  for target in
    select *
    from public.agent_tasks
    where state not in ('COMPLETE', 'FAILED', 'CANCELLED')
      and cancel_requested = true
      and (lease_token is null or lease_expires_at <= now())
    for update skip locked
  loop
    update public.agent_tasks t
    set state = 'CANCELLED',
        completed_at = now(),
        evidence = t.evidence || jsonb_build_object('reason', 'cancel_requested'),
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where t.id = target.id;

    perform public.append_agent_event(
      target.id,
      'task_cancelled',
      jsonb_build_object('reason', 'cancel_requested')
    );

    cancelled := cancelled + 1;
  end loop;

  return query select failed, cancelled;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Least-privilege grants and the future worker role
-- ---------------------------------------------------------------------------

revoke all privileges on table
  public.agent_sessions,
  public.agent_tasks,
  public.agent_task_steps,
  public.agent_events
from public, anon, authenticated;

grant select on table
  public.agent_sessions,
  public.agent_tasks,
  public.agent_task_steps,
  public.agent_events
to authenticated;

grant select, insert, update, delete on table
  public.agent_sessions,
  public.agent_tasks,
  public.agent_task_steps,
  public.agent_events
to service_role;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'nexa_agent_runtime'
  ) then
    create role nexa_agent_runtime nologin noinherit nobypassrls;
  end if;
end;
$$;

grant usage on schema public to nexa_agent_runtime;

grant select on table
  public.agent_sessions,
  public.agent_tasks,
  public.agent_task_steps,
  public.agent_events
to nexa_agent_runtime;

revoke all on function public.agent_task_transition_allowed(text, text) from public, anon, authenticated;
revoke all on function public.append_agent_event(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_agent_task(text, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_agent_task(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_agent_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.transition_agent_task(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_agent_step(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.request_agent_task_cancel(uuid, uuid) from public, anon, authenticated;
revoke all on function public.request_agent_task_cancel(uuid) from public, anon, authenticated;
revoke all on function public.reap_agent_tasks() from public, anon, authenticated;

grant execute on function public.append_agent_event(uuid, text, jsonb) to service_role, nexa_agent_runtime;
grant execute on function public.claim_agent_task(text, integer) to service_role, nexa_agent_runtime;
grant execute on function public.heartbeat_agent_task(uuid, uuid, integer) to service_role, nexa_agent_runtime;
grant execute on function public.release_agent_task(uuid, uuid) to service_role, nexa_agent_runtime;
grant execute on function public.transition_agent_task(uuid, uuid, text, text, text, jsonb) to service_role, nexa_agent_runtime;
grant execute on function public.record_agent_step(uuid, uuid, uuid, text, jsonb) to service_role, nexa_agent_runtime;
grant execute on function public.request_agent_task_cancel(uuid, uuid) to service_role, nexa_agent_runtime;
grant execute on function public.request_agent_task_cancel(uuid) to authenticated, service_role;
grant execute on function public.reap_agent_tasks() to service_role, nexa_agent_runtime;

commit;
