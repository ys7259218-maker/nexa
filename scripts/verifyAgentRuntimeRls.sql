-- Disposable local database only. Every synthetic row is rolled back.
--
-- Phase B B1 RLS cross-tenant fixture and grant-matrix probe. The existing
-- local replay harness runs this after both canonical migration replays.
-- It proves that two workspaces cannot read each other's agent rows through
-- the authenticated role, and that direct authenticated/worker writes remain
-- denied outside the reviewed RPCs.
begin;

do $fixture$
declare
  v_user_a uuid := '00000000-0000-0000-0000-00000000b101';
  v_user_b uuid := '00000000-0000-0000-0000-00000000b102';
  v_session_a uuid := '00000000-0000-0000-0000-00000000b103';
  v_session_b uuid := '00000000-0000-0000-0000-00000000b104';
  v_task_a uuid := '00000000-0000-0000-0000-00000000b105';
  v_task_b uuid := '00000000-0000-0000-0000-00000000b106';
  v_step_a uuid := '00000000-0000-0000-0000-00000000b107';
  v_step_b uuid := '00000000-0000-0000-0000-00000000b108';
  v_workspace_a uuid;
  v_workspace_b uuid;
begin
  if exists (select 1 from public.agent_sessions)
    or exists (select 1 from public.agent_tasks)
    or exists (select 1 from public.agent_task_steps)
    or exists (select 1 from public.agent_events) then
    raise exception 'agent RLS probe requires an empty disposable database';
  end if;

  insert into auth.users (id, email)
  values
    (v_user_a, 'agent-rls-a@example.invalid'),
    (v_user_b, 'agent-rls-b@example.invalid');

  select id into strict v_workspace_a
  from public.workspaces
  where created_by = v_user_a and is_personal;
  select id into strict v_workspace_b
  from public.workspaces
  where created_by = v_user_b and is_personal;

  insert into public.agent_sessions (id, workspace_id, user_id)
  values
    (v_session_a, v_workspace_a, v_user_a),
    (v_session_b, v_workspace_b, v_user_b);

  insert into public.agent_tasks
    (id, session_id, workspace_id, goal, created_by, deadline_at)
  values
    (v_task_a, v_session_a, v_workspace_a, 'rls fixture a', v_user_a,
      now() + interval '10 minutes'),
    (v_task_b, v_session_b, v_workspace_b, 'rls fixture b', v_user_b,
      now() + interval '10 minutes');

  insert into public.agent_task_steps
    (id, task_id, workspace_id, seq, label, args_hash, idempotency_key)
  values
    (v_step_a, v_task_a, v_workspace_a, 1, 'rls step a', repeat('a', 64),
      'rls-step-a'),
    (v_step_b, v_task_b, v_workspace_b, 1, 'rls step b', repeat('b', 64),
      'rls-step-b');

  insert into public.agent_events (workspace_id, task_id, seq, type, payload)
  values
    (v_workspace_a, v_task_a, 1, 'task_created', '{}'::jsonb),
    (v_workspace_b, v_task_b, 1, 'task_created', '{}'::jsonb);

  -- Authenticated users may read agent tables but never write them directly.
  if has_table_privilege('authenticated', 'public.agent_tasks', 'INSERT')
    or has_table_privilege('authenticated', 'public.agent_tasks', 'UPDATE')
    or has_table_privilege('authenticated', 'public.agent_tasks', 'DELETE')
    or has_table_privilege('anon', 'public.agent_tasks', 'SELECT') then
    raise exception 'authenticated/anon agent table privileges are not select-only';
  end if;

  -- Only the user-facing cancel wrapper is exposed to authenticated callers.
  if has_function_privilege('authenticated', 'public.claim_agent_task(text, integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.transition_agent_task(uuid, uuid, text, text, text, jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.record_agent_step(uuid, uuid, uuid, text, jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reap_agent_tasks()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.request_agent_task_cancel(uuid, uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.request_agent_task_cancel(uuid)', 'EXECUTE') then
    raise exception 'authenticated agent RPC matrix is not the reviewed set';
  end if;

  -- The worker role reads only the agent tables and executes only reviewed RPCs.
  if has_table_privilege('nexa_agent_runtime', 'public.agent_tasks', 'INSERT')
    or has_table_privilege('nexa_agent_runtime', 'public.agent_tasks', 'UPDATE')
    or has_table_privilege('nexa_agent_runtime', 'public.agent_tasks', 'DELETE')
    or has_table_privilege('nexa_agent_runtime', 'public.workspaces', 'SELECT')
    or has_table_privilege('nexa_agent_runtime', 'public.messages', 'SELECT')
    or not has_function_privilege('nexa_agent_runtime', 'public.claim_agent_task(text, integer)', 'EXECUTE') then
    raise exception 'worker role grant matrix is not the reviewed set';
  end if;
end $fixture$;

-- Tenant A sees exactly its own rows and nothing from tenant B.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000b101', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $tenant_a$
declare
  v_task_a uuid := '00000000-0000-0000-0000-00000000b105';
  v_task_b uuid := '00000000-0000-0000-0000-00000000b106';
  v_count integer;
begin
  select count(*) into v_count
  from public.agent_sessions
  where id in (
    '00000000-0000-0000-0000-00000000b103',
    '00000000-0000-0000-0000-00000000b104'
  );
  if v_count <> 1 then
    raise exception 'tenant A must see exactly one agent session';
  end if;

  select count(*) into v_count
  from public.agent_tasks
  where id in (v_task_a, v_task_b);
  if v_count <> 1 then
    raise exception 'tenant A must see exactly one agent task';
  end if;

  select count(*) into v_count
  from public.agent_task_steps
  where id in (
    '00000000-0000-0000-0000-00000000b107',
    '00000000-0000-0000-0000-00000000b108'
  );
  if v_count <> 1 then
    raise exception 'tenant A must see exactly one agent step';
  end if;

  select count(*) into v_count
  from public.agent_events
  where task_id in (v_task_a, v_task_b);
  if v_count <> 1 then
    raise exception 'tenant A must see exactly one agent event';
  end if;

  if exists (select 1 from public.agent_tasks where id = v_task_b) then
    raise exception 'cross-tenant agent task leaked to tenant A';
  end if;

  begin
    insert into public.agent_tasks
      (session_id, workspace_id, goal, created_by, deadline_at)
    values
      ('00000000-0000-0000-0000-00000000b103',
       (select workspace_id from public.agent_tasks where id = v_task_a),
       'direct authenticated insert must fail',
       '00000000-0000-0000-0000-00000000b101',
       now() + interval '10 minutes');
    raise exception 'authenticated agent insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.agent_tasks set goal = 'mutated' where id = v_task_a;
    raise exception 'authenticated agent update unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.agent_events where task_id = v_task_a;
    raise exception 'authenticated agent delete unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end $tenant_a$;

reset role;

-- Tenant B sees exactly its own rows and nothing from tenant A.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000b102', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $tenant_b$
declare
  v_task_a uuid := '00000000-0000-0000-0000-00000000b105';
  v_task_b uuid := '00000000-0000-0000-0000-00000000b106';
  v_count integer;
begin
  select count(*) into v_count
  from public.agent_tasks
  where id in (v_task_a, v_task_b);
  if v_count <> 1 then
    raise exception 'tenant B must see exactly one agent task';
  end if;

  if exists (select 1 from public.agent_tasks where id = v_task_a) then
    raise exception 'cross-tenant agent task leaked to tenant B';
  end if;
end $tenant_b$;

reset role;

-- The user-facing cancel wrapper is scoped to the caller even when the target
-- task exists in another workspace.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000b101', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $cross_tenant_cancel$
declare
  v_reason text;
begin
  select reason into v_reason
  from public.request_agent_task_cancel('00000000-0000-0000-0000-00000000b106');
  if v_reason is distinct from 'not_authorized' then
    raise exception 'cross-tenant agent cancel was not denied';
  end if;
end $cross_tenant_cancel$;

reset role;

rollback;
