-- Disposable local database only. Every synthetic row is rolled back.
--
-- Phase B B2 tool-registry RLS cross-tenant fixture and grant-matrix probe.
-- The existing local replay harness runs this after both canonical migration
-- replays. It proves that two workspaces cannot read each other's manifests or
-- invocations through the authenticated role, that direct writes remain denied
-- outside the reviewed RPCs, and that invocation audit rows are append-only.
begin;

do $fixture$
declare
  v_user_a uuid := '00000000-0000-0000-0000-00000000b201';
  v_user_b uuid := '00000000-0000-0000-0000-00000000b202';
  v_session_a uuid := '00000000-0000-0000-0000-00000000b203';
  v_session_b uuid := '00000000-0000-0000-0000-00000000b204';
  v_task_a uuid := '00000000-0000-0000-0000-00000000b205';
  v_task_b uuid := '00000000-0000-0000-0000-00000000b206';
  v_step_a uuid := '00000000-0000-0000-0000-00000000b207';
  v_step_b uuid := '00000000-0000-0000-0000-00000000b208';
  v_workspace_a uuid;
  v_workspace_b uuid;
  v_manifest jsonb := $manifest$
    {
      "name": "workspace.file.read",
      "version": "1.0.0",
      "description": "RLS fixture manifest",
      "timeoutClass": "fast",
      "maxAttempts": 1,
      "riskTier": "T1",
      "inputSchema": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path"],
        "properties": {
          "path": {"type": "string", "minLength": 1, "maxLength": 512}
        }
      },
      "outputSchema": {
        "type": "object",
        "additionalProperties": false,
        "required": ["path"],
        "properties": {
          "path": {"type": "string", "minLength": 1, "maxLength": 512}
        }
      }
    }
  $manifest$::jsonb;
  v_hash_a text := repeat('a', 64);
  v_hash_b text := repeat('b', 64);
  v_reason text;
begin
  if exists (select 1 from public.agent_tool_manifests)
    or exists (select 1 from public.agent_tool_invocations) then
    raise exception 'tool registry RLS probe requires empty tool tables';
  end if;

  insert into auth.users (id, email)
  values
    (v_user_a, 'tool-rls-a@example.invalid'),
    (v_user_b, 'tool-rls-b@example.invalid');

  select id into strict v_workspace_a
  from public.workspaces
  where created_by = v_user_a and is_personal;
  select id into strict v_workspace_b
  from public.workspaces
  where created_by = v_user_b and is_personal;

  perform set_config('nexa.tool_rls.workspace_a', v_workspace_a::text, true);
  perform set_config('nexa.tool_rls.workspace_b', v_workspace_b::text, true);

  insert into public.agent_sessions (id, workspace_id, user_id)
  values
    (v_session_a, v_workspace_a, v_user_a),
    (v_session_b, v_workspace_b, v_user_b);

  insert into public.agent_tasks
    (id, session_id, workspace_id, goal, created_by, deadline_at)
  values
    (v_task_a, v_session_a, v_workspace_a, 'tool rls fixture a', v_user_a,
      now() + interval '10 minutes'),
    (v_task_b, v_session_b, v_workspace_b, 'tool rls fixture b', v_user_b,
      now() + interval '10 minutes');

  insert into public.agent_task_steps
    (id, task_id, workspace_id, seq, label, args_hash, idempotency_key)
  values
    (v_step_a, v_task_a, v_workspace_a, 1, 'tool rls step a', repeat('c', 64),
      'tool-rls-step-a'),
    (v_step_b, v_task_b, v_workspace_b, 1, 'tool rls step b', repeat('d', 64),
      'tool-rls-step-b');

  -- Manifests are written only through the reviewed RPC.
  select reason into v_reason
  from public.upsert_agent_tool_manifest(
    v_workspace_a, 'workspace.file.read', '1.0.0', v_manifest, v_hash_a
  );
  if v_reason is distinct from 'upserted' then
    raise exception 'tenant A manifest upsert failed: %', v_reason;
  end if;

  select reason into v_reason
  from public.upsert_agent_tool_manifest(
    v_workspace_b, 'workspace.file.read', '1.0.0', v_manifest, v_hash_b
  );
  if v_reason is distinct from 'upserted' then
    raise exception 'tenant B manifest upsert failed: %', v_reason;
  end if;

  -- One complete audit row per tenant, linked to that tenant's task/step.
  select reason into v_reason
  from public.record_agent_tool_invocation(
    v_workspace_a, 'rls-inv-a', 'workspace.file.read', '1.0.0', v_hash_a,
    'fast', repeat('e', 64), 'SUCCEEDED', null, 1, 5,
    repeat('f', 64), v_task_a, v_step_a
  );
  if v_reason is distinct from 'recorded' then
    raise exception 'tenant A invocation record failed: %', v_reason;
  end if;

  select reason into v_reason
  from public.record_agent_tool_invocation(
    v_workspace_b, 'rls-inv-b', 'workspace.file.read', '1.0.0', v_hash_b,
    'fast', repeat('1', 64), 'SUCCEEDED', null, 1, 5,
    repeat('2', 64), v_task_b, v_step_b
  );
  if v_reason is distinct from 'recorded' then
    raise exception 'tenant B invocation record failed: %', v_reason;
  end if;

  -- The RPC rejects cross-tenant task/step references and unknown manifests.
  select reason into v_reason
  from public.record_agent_tool_invocation(
    v_workspace_a, 'rls-cross-task', 'workspace.file.read', '1.0.0', v_hash_a,
    'fast', repeat('3', 64), 'SUCCEEDED', null, 1, 0,
    repeat('4', 64), v_task_b, null
  );
  if v_reason is distinct from 'task_workspace_mismatch' then
    raise exception 'cross-tenant task reference was not rejected: %', v_reason;
  end if;

  select reason into v_reason
  from public.record_agent_tool_invocation(
    v_workspace_a, 'rls-cross-step', 'workspace.file.read', '1.0.0', v_hash_a,
    'fast', repeat('5', 64), 'SUCCEEDED', null, 1, 0,
    repeat('6', 64), v_task_a, v_step_b
  );
  if v_reason is distinct from 'step_workspace_mismatch' then
    raise exception 'cross-tenant step reference was not rejected: %', v_reason;
  end if;

  select reason into v_reason
  from public.record_agent_tool_invocation(
    v_workspace_a, 'rls-missing-manifest', 'workspace.file.read', '1.0.0',
    repeat('9', 64), 'fast', repeat('7', 64), 'SUCCEEDED', null, 1, 0,
    repeat('8', 64), v_task_a, v_step_a
  );
  if v_reason is distinct from 'manifest_missing' then
    raise exception 'unapproved manifest was not rejected: %', v_reason;
  end if;

  -- Unknown manifest fields are rejected before an upsert.
  select reason into v_reason
  from public.upsert_agent_tool_manifest(
    v_workspace_a, 'workspace.file.read', '1.0.0',
    v_manifest || jsonb_build_object('hiddenSideEffect', true), v_hash_a
  );
  if v_reason is distinct from 'invalid_manifest' then
    raise exception 'unknown manifest field was not rejected: %', v_reason;
  end if;

  -- Invocation audit rows cannot be updated or deleted.
  begin
    update public.agent_tool_invocations
    set status = 'FAILED', error_class = 'INTERNAL', output_hash = null
    where workspace_id = v_workspace_a;
    raise exception 'append-only update unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%append-only%' then
      raise;
    end if;
  end;

  begin
    delete from public.agent_tool_invocations where workspace_id = v_workspace_a;
    raise exception 'append-only delete unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%append-only%' then
      raise;
    end if;
  end;

  -- Authenticated callers get select only and no mutation RPC execution.
  if has_table_privilege('authenticated', 'public.agent_tool_manifests', 'INSERT')
    or has_table_privilege('authenticated', 'public.agent_tool_manifests', 'UPDATE')
    or has_table_privilege('authenticated', 'public.agent_tool_manifests', 'DELETE')
    or has_table_privilege('authenticated', 'public.agent_tool_invocations', 'INSERT')
    or has_table_privilege('authenticated', 'public.agent_tool_invocations', 'UPDATE')
    or has_table_privilege('authenticated', 'public.agent_tool_invocations', 'DELETE')
    or has_table_privilege('anon', 'public.agent_tool_manifests', 'SELECT')
    or has_table_privilege('anon', 'public.agent_tool_invocations', 'SELECT') then
    raise exception 'authenticated/anon tool table privileges are not select-only';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.upsert_agent_tool_manifest(uuid, text, text, jsonb, text, uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_agent_tool_invocation(uuid, text, text, text, text, text, text, text, text, integer, integer, text, uuid, uuid)',
       'EXECUTE'
     ) then
    raise exception 'authenticated tool RPC matrix is not the reviewed set';
  end if;

  -- The worker role reads the tool tables and executes only reviewed RPCs.
  if not has_table_privilege('nexa_agent_runtime', 'public.agent_tool_manifests', 'SELECT')
    or not has_table_privilege('nexa_agent_runtime', 'public.agent_tool_invocations', 'SELECT')
    or has_table_privilege('nexa_agent_runtime', 'public.agent_tool_manifests', 'INSERT')
    or has_table_privilege('nexa_agent_runtime', 'public.agent_tool_invocations', 'INSERT')
    or has_table_privilege('nexa_agent_runtime', 'public.agent_tool_invocations', 'UPDATE')
    or has_table_privilege('nexa_agent_runtime', 'public.agent_tool_invocations', 'DELETE')
    or has_table_privilege('nexa_agent_runtime', 'public.workspaces', 'SELECT')
    or not has_function_privilege(
      'nexa_agent_runtime',
      'public.upsert_agent_tool_manifest(uuid, text, text, jsonb, text, uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'nexa_agent_runtime',
      'public.record_agent_tool_invocation(uuid, text, text, text, text, text, text, text, text, integer, integer, text, uuid, uuid)',
      'EXECUTE'
    ) then
    raise exception 'worker tool grant matrix is not the reviewed set';
  end if;
end $fixture$;

-- Tenant A sees exactly its own manifest and invocation.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000b201', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $tenant_a$
declare
  v_workspace_a uuid := current_setting('nexa.tool_rls.workspace_a')::uuid;
  v_workspace_b uuid := current_setting('nexa.tool_rls.workspace_b')::uuid;
  v_count integer;
begin
  select count(*) into v_count
  from public.agent_tool_manifests
  where workspace_id in (v_workspace_a, v_workspace_b);
  if v_count <> 1 then
    raise exception 'tenant A must see exactly one tool manifest';
  end if;

  if exists (
    select 1 from public.agent_tool_manifests where workspace_id = v_workspace_b
  ) then
    raise exception 'cross-tenant tool manifest leaked to tenant A';
  end if;

  select count(*) into v_count
  from public.agent_tool_invocations
  where workspace_id in (v_workspace_a, v_workspace_b);
  if v_count <> 1 then
    raise exception 'tenant A must see exactly one tool invocation';
  end if;

  if exists (
    select 1 from public.agent_tool_invocations where invocation_key = 'rls-inv-b'
  ) then
    raise exception 'cross-tenant tool invocation leaked to tenant A';
  end if;

  begin
    insert into public.agent_tool_manifests
      (workspace_id, tool_name, tool_version, manifest, manifest_hash)
    values
      (v_workspace_a,
       'workspace.file.read', '1.0.0', '{}'::jsonb, repeat('a', 64));
    raise exception 'authenticated tool manifest insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.agent_tool_invocations set duration_ms = 0
    where invocation_key = 'rls-inv-a';
    raise exception 'authenticated tool invocation update unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.agent_tool_invocations where invocation_key = 'rls-inv-a';
    raise exception 'authenticated tool invocation delete unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end $tenant_a$;

reset role;

-- Tenant B sees exactly its own invocation and nothing from tenant A.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000b202', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $tenant_b$
declare
  v_workspace_a uuid := current_setting('nexa.tool_rls.workspace_a')::uuid;
  v_workspace_b uuid := current_setting('nexa.tool_rls.workspace_b')::uuid;
  v_count integer;
begin
  select count(*) into v_count
  from public.agent_tool_invocations
  where workspace_id in (v_workspace_a, v_workspace_b);
  if v_count <> 1 then
    raise exception 'tenant B must see exactly one tool invocation';
  end if;

  if exists (
    select 1 from public.agent_tool_invocations where invocation_key = 'rls-inv-a'
  ) then
    raise exception 'cross-tenant tool invocation leaked to tenant B';
  end if;
end $tenant_b$;

reset role;

rollback;
