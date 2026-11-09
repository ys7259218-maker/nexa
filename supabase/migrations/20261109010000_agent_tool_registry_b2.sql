-- Phase B milestone B2: tool registry and execution contracts (additive only).
--
-- This migration adds the reviewed workspace-scoped tool manifest table, the
-- append-only per-invocation audit table, and the two SECURITY DEFINER RPCs
-- that are the only mutation paths. It does not alter any existing table,
-- policy, grant, trigger, or function.
--
-- B2 adapters are contracts and deterministic mocks only. Nothing here calls a
-- model provider, WhatsApp, OAuth, the network, a browser, the filesystem, or
-- any calendar API. The tables are inert until the registry feature flag is
-- explicitly enabled outside production.
begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.agent_tool_manifests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tool_name text not null,
  tool_version text not null,
  manifest jsonb not null,
  manifest_hash text not null,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_tool_manifests_tool_name_check check (
    tool_name ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$'
  ),
  constraint agent_tool_manifests_tool_version_check check (
    tool_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
  ),
  constraint agent_tool_manifests_hash_check check (
    manifest_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_tool_manifests_manifest_shape_check check (
    jsonb_typeof(manifest) = 'object'
    and manifest ? 'name'
    and manifest ? 'version'
    and manifest ? 'description'
    and manifest ? 'timeoutClass'
    and manifest ? 'maxAttempts'
    and manifest ? 'riskTier'
    and manifest ? 'inputSchema'
    and manifest ? 'outputSchema'
    and manifest->>'name' = tool_name
    and manifest->>'version' = tool_version
    and char_length(coalesce(manifest->>'description', '')) between 1 and 500
    and coalesce(manifest->>'timeoutClass', '') in ('fast', 'standard', 'long')
    and coalesce(manifest->>'maxAttempts', '') ~ '^[1-3]$'
    and coalesce(manifest->>'riskTier', '') in ('T0', 'T1')
    and jsonb_typeof(manifest->'inputSchema') = 'object'
    and jsonb_typeof(manifest->'outputSchema') = 'object'
    and (
      manifest
        - 'name'
        - 'version'
        - 'description'
        - 'timeoutClass'
        - 'maxAttempts'
        - 'riskTier'
        - 'inputSchema'
        - 'outputSchema'
    ) = '{}'::jsonb
  ),
  constraint agent_tool_manifests_workspace_tool_key unique (
    workspace_id, tool_name, tool_version
  ),
  constraint agent_tool_manifests_workspace_id_id_key unique (workspace_id, id)
);

create table if not exists public.agent_tool_invocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid references public.agent_tasks(id) on delete set null,
  step_id uuid references public.agent_task_steps(id) on delete set null,
  invocation_key text not null,
  tool_name text not null,
  tool_version text not null,
  manifest_hash text not null,
  timeout_class text not null,
  args_hash text not null,
  output_hash text,
  status text not null,
  error_class text,
  attempt integer not null,
  duration_ms integer not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  constraint agent_tool_invocations_invocation_key_check check (
    invocation_key ~ '^[A-Za-z0-9:_-]{1,200}$'
  ),
  constraint agent_tool_invocations_tool_name_check check (
    tool_name ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$'
  ),
  constraint agent_tool_invocations_tool_version_check check (
    tool_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
  ),
  constraint agent_tool_invocations_manifest_hash_check check (
    manifest_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_tool_invocations_args_hash_check check (
    args_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_tool_invocations_output_hash_check check (
    output_hash is null or output_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_tool_invocations_timeout_class_check check (
    timeout_class in ('fast', 'standard', 'long')
  ),
  constraint agent_tool_invocations_status_check check (
    status in ('SUCCEEDED', 'FAILED')
  ),
  constraint agent_tool_invocations_error_class_check check (
    error_class is null
    or error_class in ('VALIDATION', 'PERMISSION', 'RATE_LIMIT', 'TIMEOUT', 'UPSTREAM', 'INTERNAL')
  ),
  constraint agent_tool_invocations_outcome_check check (
    (status = 'SUCCEEDED' and error_class is null and output_hash is not null)
    or (status = 'FAILED' and error_class is not null and output_hash is null)
  ),
  constraint agent_tool_invocations_attempt_check check (attempt between 1 and 3),
  constraint agent_tool_invocations_duration_check check (duration_ms between 0 and 600000),
  constraint agent_tool_invocations_workspace_invocation_attempt_key unique (
    workspace_id, invocation_key, attempt
  )
);

create index if not exists agent_tool_manifests_workspace_idx
  on public.agent_tool_manifests (workspace_id, tool_name, tool_version);

create index if not exists agent_tool_invocations_workspace_created_idx
  on public.agent_tool_invocations (workspace_id, created_at desc);

create index if not exists agent_tool_invocations_task_idx
  on public.agent_tool_invocations (task_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Row-level security: authenticated reads only, workspace-scoped.
-- ---------------------------------------------------------------------------

alter table public.agent_tool_manifests enable row level security;
alter table public.agent_tool_invocations enable row level security;

drop policy if exists "Agent tool manifests are readable by workspace members"
  on public.agent_tool_manifests;
create policy "Agent tool manifests are readable by workspace members"
  on public.agent_tool_manifests for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Agent tool invocations are readable by workspace members"
  on public.agent_tool_invocations;
create policy "Agent tool invocations are readable by workspace members"
  on public.agent_tool_invocations for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- 3. Append-only invocation audit
-- ---------------------------------------------------------------------------

create or replace function public.prevent_agent_tool_invocation_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Agent tool invocations are append-only';
end;
$$;

revoke all on function public.prevent_agent_tool_invocation_mutation()
  from public, anon, authenticated;

drop trigger if exists prevent_agent_tool_invocation_update
  on public.agent_tool_invocations;
create trigger prevent_agent_tool_invocation_update
  before update or delete on public.agent_tool_invocations
  for each row execute function public.prevent_agent_tool_invocation_mutation();

-- ---------------------------------------------------------------------------
-- 4. Reviewed mutation RPCs
-- ---------------------------------------------------------------------------

create or replace function public.upsert_agent_tool_manifest(
  p_workspace_id uuid,
  p_tool_name text,
  p_tool_version text,
  p_manifest jsonb,
  p_manifest_hash text,
  p_created_by uuid default null
)
returns table (reason text, manifest_id uuid)
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

  if p_manifest_hash is null or p_manifest_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_manifest_hash'::text, null::uuid;
    return;
  end if;

  if p_created_by is not null
     and not exists (select 1 from auth.users where id = p_created_by) then
    return query select 'invalid_created_by'::text, null::uuid;
    return;
  end if;

  if p_manifest is null
     or jsonb_typeof(p_manifest) <> 'object'
     or not (p_manifest ? 'name')
     or not (p_manifest ? 'version')
     or not (p_manifest ? 'description')
     or not (p_manifest ? 'timeoutClass')
     or not (p_manifest ? 'maxAttempts')
     or not (p_manifest ? 'riskTier')
     or not (p_manifest ? 'inputSchema')
     or not (p_manifest ? 'outputSchema')
     or p_manifest->>'name' is distinct from p_tool_name
     or p_manifest->>'version' is distinct from p_tool_version
     or char_length(coalesce(p_manifest->>'description', '')) not between 1 and 500
     or coalesce(p_manifest->>'timeoutClass', '') not in ('fast', 'standard', 'long')
     or coalesce(p_manifest->>'maxAttempts', '') !~ '^[1-3]$'
     or coalesce(p_manifest->>'riskTier', '') not in ('T0', 'T1')
     or jsonb_typeof(p_manifest->'inputSchema') <> 'object'
     or jsonb_typeof(p_manifest->'outputSchema') <> 'object'
     or (
       p_manifest
         - 'name'
         - 'version'
         - 'description'
         - 'timeoutClass'
         - 'maxAttempts'
         - 'riskTier'
         - 'inputSchema'
         - 'outputSchema'
     ) <> '{}'::jsonb then
    return query select 'invalid_manifest'::text, null::uuid;
    return;
  end if;

  insert into public.agent_tool_manifests (
    workspace_id, tool_name, tool_version, manifest, manifest_hash, enabled, created_by
  )
  values (
    p_workspace_id, p_tool_name, p_tool_version, p_manifest, p_manifest_hash, true, p_created_by
  )
  on conflict (workspace_id, tool_name, tool_version) do update
  set manifest = excluded.manifest,
      manifest_hash = excluded.manifest_hash,
      enabled = true,
      updated_at = now()
  returning id into inserted_id;

  return query select 'upserted'::text, inserted_id;
end;
$$;

create or replace function public.record_agent_tool_invocation(
  p_workspace_id uuid,
  p_invocation_key text,
  p_tool_name text,
  p_tool_version text,
  p_manifest_hash text,
  p_timeout_class text,
  p_args_hash text,
  p_status text,
  p_error_class text,
  p_attempt integer,
  p_duration_ms integer,
  p_output_hash text default null,
  p_task_id uuid default null,
  p_step_id uuid default null
)
returns table (reason text, invocation_id uuid)
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

  if p_invocation_key is null
     or p_invocation_key !~ '^[A-Za-z0-9:_-]{1,200}$' then
    return query select 'invalid_invocation_key'::text, null::uuid;
    return;
  end if;

  if p_tool_name is null
     or p_tool_name !~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$'
     or p_tool_version is null
     or p_tool_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then
    return query select 'invalid_tool'::text, null::uuid;
    return;
  end if;

  if p_manifest_hash is null or p_manifest_hash !~ '^[0-9a-f]{64}$'
     or p_args_hash is null or p_args_hash !~ '^[0-9a-f]{64}$'
     or (p_output_hash is not null and p_output_hash !~ '^[0-9a-f]{64}$') then
    return query select 'invalid_hash'::text, null::uuid;
    return;
  end if;

  if p_timeout_class is null
     or p_timeout_class not in ('fast', 'standard', 'long') then
    return query select 'invalid_timeout_class'::text, null::uuid;
    return;
  end if;

  if p_status is null or p_status not in ('SUCCEEDED', 'FAILED') then
    return query select 'invalid_status'::text, null::uuid;
    return;
  end if;

  if p_error_class is not null
     and p_error_class not in (
       'VALIDATION', 'PERMISSION', 'RATE_LIMIT', 'TIMEOUT', 'UPSTREAM', 'INTERNAL'
     ) then
    return query select 'invalid_error_class'::text, null::uuid;
    return;
  end if;

  if (p_status = 'SUCCEEDED' and (p_error_class is not null or p_output_hash is null))
     or (p_status = 'FAILED' and (p_error_class is null or p_output_hash is not null)) then
    return query select 'invalid_outcome'::text, null::uuid;
    return;
  end if;

  if p_attempt is null or p_attempt not between 1 and 3
     or p_duration_ms is null or p_duration_ms not between 0 and 600000 then
    return query select 'invalid_attempt'::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1
    from public.agent_tool_manifests m
    where m.workspace_id = p_workspace_id
      and m.tool_name = p_tool_name
      and m.tool_version = p_tool_version
      and m.manifest_hash = p_manifest_hash
      and m.enabled = true
  ) then
    return query select 'manifest_missing'::text, null::uuid;
    return;
  end if;

  if p_task_id is not null and not exists (
    select 1
    from public.agent_tasks t
    where t.id = p_task_id and t.workspace_id = p_workspace_id
  ) then
    return query select 'task_workspace_mismatch'::text, null::uuid;
    return;
  end if;

  if p_step_id is not null and not exists (
    select 1
    from public.agent_task_steps s
    where s.id = p_step_id and s.workspace_id = p_workspace_id
  ) then
    return query select 'step_workspace_mismatch'::text, null::uuid;
    return;
  end if;

  insert into public.agent_tool_invocations (
    workspace_id, task_id, step_id, invocation_key, tool_name, tool_version,
    manifest_hash, timeout_class, args_hash, output_hash, status, error_class,
    attempt, duration_ms
  )
  values (
    p_workspace_id, p_task_id, p_step_id, p_invocation_key, p_tool_name, p_tool_version,
    p_manifest_hash, p_timeout_class, p_args_hash, p_output_hash, p_status, p_error_class,
    p_attempt, p_duration_ms
  )
  returning id into inserted_id;

  return query select 'recorded'::text, inserted_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Least-privilege grants
-- ---------------------------------------------------------------------------

revoke all privileges on table
  public.agent_tool_manifests,
  public.agent_tool_invocations
from public, anon, authenticated;

grant select on table
  public.agent_tool_manifests,
  public.agent_tool_invocations
to authenticated;

grant select on table
  public.agent_tool_manifests,
  public.agent_tool_invocations
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
  public.agent_tool_manifests,
  public.agent_tool_invocations
to nexa_agent_runtime;

revoke all on function public.prevent_agent_tool_invocation_mutation()
  from public, anon, authenticated;
revoke all on function public.upsert_agent_tool_manifest(uuid, text, text, jsonb, text, uuid)
  from public, anon, authenticated;
revoke all on function public.record_agent_tool_invocation(
  uuid, text, text, text, text, text, text, text, text, integer, integer, text, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.upsert_agent_tool_manifest(uuid, text, text, jsonb, text, uuid)
  to service_role, nexa_agent_runtime;
grant execute on function public.record_agent_tool_invocation(
  uuid, text, text, text, text, text, text, text, text, integer, integer, text, uuid, uuid
) to service_role, nexa_agent_runtime;

commit;
