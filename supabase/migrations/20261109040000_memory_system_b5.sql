-- Phase B milestone B5: memory system (additive only).
--
-- This migration adds the memory layer tables (M1 session scratchpad, M2 task
-- memory, M3 user-approved persistent memory, M5 external data references),
-- the consent records table, and the SECURITY DEFINER RPCs that are the only
-- mutation paths. It does not alter any existing table, policy, grant,
-- trigger, or function.
--
-- The existing `knowledge_entries` table (M4 knowledge retrieval) already
-- exists from the Knowledge v0 migration and is not altered by this migration.
-- M0 conversation context (bounded recent turns) is also untouched.
--
-- Nothing here calls a model provider, WhatsApp, OAuth, the network, a
-- browser, the filesystem, or any calendar API. The tables are inert until
-- the memory system feature flag is explicitly enabled outside production.
begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- M1 session scratchpad — task-scoped working state, task TTL, workspace-scoped
create table if not exists public.memory_session_scratchpad (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  scratchpad_key text not null,
  scratchpad_value jsonb not null,
  ttl_seconds integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_scratchpad_ttl_seconds_check check (
    ttl_seconds between 1 and 604800
  ),
  constraint memory_scratchpad_expiry_check check (expires_at > created_at),
  constraint memory_scratchpad_task_key unique (workspace_id, task_id, scratchpad_key),
  constraint memory_scratchpad_workspace_id_id_key unique (workspace_id, id)
);

-- M2 task memory — structured step outputs, artifacts, evidence links
create table if not exists public.memory_task_memory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  step_seq integer not null,
  output_key text not null,
  output_value_hash text not null,
  artifact_ref text,
  evidence_link text,
  retention_window_seconds integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_task_memory_retention_check check (
    retention_window_seconds between 1 and 604800
  ),
  constraint memory_task_memory_expiry_check check (expires_at > created_at),
  constraint memory_task_memory_output_hash_check check (
    output_value_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint memory_task_memory_step_key unique (workspace_id, task_id, step_seq, output_key),
  constraint memory_task_memory_workspace_id_id_key unique (workspace_id, id)
);

-- M3 user-approved persistent memory — explicit facts the user chose to keep
create table if not exists public.memory_user_approved_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fact_key text not null,
  fact_value_hash text not null,
  consent_record_id uuid not null references public.memory_consent_records(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memory_facts_fact_hash_check check (
    fact_value_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint memory_facts_expiry_check check (expires_at is null or expires_at > created_at),
  constraint memory_facts_workspace_key unique (workspace_id, fact_key),
  constraint memory_facts_workspace_id_id_key unique (workspace_id, id)
);

-- M5 external data references — URLs/IDs only, never bulk-fetched copies
create table if not exists public.memory_external_data_refs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ref_key text not null,
  ref_url text,
  ref_id text,
  revalidation_window_seconds integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_refs_retention_check check (
    revalidation_window_seconds between 1 and 604800
  ),
  constraint memory_refs_expiry_check check (expires_at > created_at),
  constraint memory_refs_has_reference check (
    ref_url is not null or ref_id is not null
  ),
  constraint memory_refs_workspace_key unique (workspace_id, ref_key),
  constraint memory_refs_workspace_id_id_key unique (workspace_id, id)
);

-- Consent records for M3 explicit consent
create table if not exists public.memory_consent_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  constraint memory_consent_type_check check (
    consent_type ~ '^[a-z][a-z0-9_]*$'
  ),
  constraint memory_consent_evidence_hash_check check (
    evidence_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint memory_consent_workspace_key unique (workspace_id, user_id, consent_type),
  constraint memory_consent_workspace_id_id_key unique (workspace_id, id)
);

create index if not exists memory_scratchpad_workspace_idx
  on public.memory_session_scratchpad (workspace_id, task_id);

create index if not exists memory_scratchpad_expiry_idx
  on public.memory_session_scratchpad (expires_at);

create index if not exists memory_task_memory_workspace_idx
  on public.memory_task_memory (workspace_id, task_id);

create index if not exists memory_task_memory_expiry_idx
  on public.memory_task_memory (expires_at);

create index if not exists memory_user_approved_facts_workspace_idx
  on public.memory_user_approved_facts (workspace_id);

create index if not exists memory_external_data_refs_workspace_idx
  on public.memory_external_data_refs (workspace_id);

create index if not exists memory_consent_records_workspace_idx
  on public.memory_consent_records (workspace_id, user_id);

-- ---------------------------------------------------------------------------
-- 2. Row-level security: authenticated reads only, workspace-scoped.
--    No client INSERT/UPDATE/DELETE policies on any of these tables.
-- ---------------------------------------------------------------------------

alter table public.memory_session_scratchpad enable row level security;
alter table public.memory_task_memory enable row level security;
alter table public.memory_user_approved_facts enable row level security;
alter table public.memory_external_data_refs enable row level security;
alter table public.memory_consent_records enable row level security;

drop policy if exists "Memory scratchpad is readable by workspace members"
  on public.memory_session_scratchpad;
create policy "Memory scratchpad is readable by workspace members"
  on public.memory_session_scratchpad for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Memory task memory is readable by workspace members"
  on public.memory_task_memory;
create policy "Memory task memory is readable by workspace members"
  on public.memory_task_memory for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Memory user-approved facts are readable by workspace members"
  on public.memory_user_approved_facts;
create policy "Memory user-approved facts are readable by workspace members"
  on public.memory_user_approved_facts for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Memory external data refs are readable by workspace members"
  on public.memory_external_data_refs;
create policy "Memory external data refs are readable by workspace members"
  on public.memory_external_data_refs for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Memory consent records are readable by workspace members"
  on public.memory_consent_records;
create policy "Memory consent records are readable by workspace members"
  on public.memory_consent_records for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- 3. Self-grant prohibition at the DB layer
-- ---------------------------------------------------------------------------
-- The nexa_memory_system role receives SELECT only on memory tables
-- (no INSERT/UPDATE/DELETE). Authenticated users receive SELECT only via RLS;
-- there are no insert/update/delete policies or table grants. All mutations
-- go through the reviewed SECURITY DEFINER RPCs below, which check workspace
-- owner/admin role.

-- ---------------------------------------------------------------------------
-- 4. Reviewed mutation RPCs (owner/admin only through SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.upsert_memory_scratchpad(
  p_workspace_id uuid,
  p_task_id uuid,
  p_scratchpad_key text,
  p_scratchpad_value jsonb,
  p_ttl_seconds integer
)
returns table (reason text, scratchpad_id uuid)
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

  if p_scratchpad_key is null or char_length(p_scratchpad_key) = 0 then
    return query select 'invalid_scratchpad_key'::text, null::uuid;
    return;
  end if;

  if p_scratchpad_value is null or jsonb_typeof(p_scratchpad_value) <> 'object' then
    return query select 'invalid_scratchpad_value'::text, null::uuid;
    return;
  end if;

  if p_ttl_seconds is null or p_ttl_seconds not between 1 and 604800 then
    return query select 'invalid_ttl_seconds'::text, null::uuid;
    return;
  end if;

  insert into public.memory_session_scratchpad (
    workspace_id, task_id, scratchpad_key, scratchpad_value, ttl_seconds, expires_at
  )
  values (
    p_workspace_id, p_task_id, p_scratchpad_key, p_scratchpad_value,
    p_ttl_seconds, now() + (p_ttl_seconds || ' seconds')::interval
  )
  on conflict (workspace_id, task_id, scratchpad_key) do update
  set scratchpad_value = excluded.scratchpad_value,
      ttl_seconds = excluded.ttl_seconds,
      expires_at = excluded.expires_at,
      updated_at = now()
  returning id into inserted_id;

  return query select 'upserted'::text, inserted_id;
end;
$$;

create or replace function public.delete_memory_scratchpad(
  p_workspace_id uuid,
  p_task_id uuid,
  p_scratchpad_key text
)
returns table (reason text, deleted_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_id uuid;
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

  delete from public.memory_session_scratchpad
  where workspace_id = p_workspace_id
    and task_id = p_task_id
    and scratchpad_key = p_scratchpad_key
  returning id into deleted_id;

  if deleted_id is null then
    return query select 'scratchpad_not_found'::text, null::uuid;
    return;
  end if;

  return query select 'deleted'::text, deleted_id;
end;
$$;

create or replace function public.upsert_memory_task_memory(
  p_workspace_id uuid,
  p_task_id uuid,
  p_step_seq integer,
  p_output_key text,
  p_output_value_hash text,
  p_artifact_ref text default null,
  p_evidence_link text default null,
  p_retention_window_seconds integer
)
returns table (reason text, memory_id uuid)
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

  if p_step_seq is null or p_step_seq < 1 then
    return query select 'invalid_step_seq'::text, null::uuid;
    return;
  end if;

  if p_output_key is null or char_length(p_output_key) = 0 then
    return query select 'invalid_output_key'::text, null::uuid;
    return;
  end if;

  if p_output_value_hash is null
     or p_output_value_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_output_value_hash'::text, null::uuid;
    return;
  end if;

  if p_retention_window_seconds is null
     or p_retention_window_seconds not between 1 and 604800 then
    return query select 'invalid_retention_window_seconds'::text, null::uuid;
    return;
  end if;

  insert into public.memory_task_memory (
    workspace_id, task_id, step_seq, output_key, output_value_hash,
    artifact_ref, evidence_link, retention_window_seconds, expires_at
  )
  values (
    p_workspace_id, p_task_id, p_step_seq, p_output_key, p_output_value_hash,
    p_artifact_ref, p_evidence_link, p_retention_window_seconds,
    now() + (p_retention_window_seconds || ' seconds')::interval
  )
  on conflict (workspace_id, task_id, step_seq, output_key) do update
  set output_value_hash = excluded.output_value_hash,
      artifact_ref = excluded.artifact_ref,
      evidence_link = excluded.evidence_link,
      retention_window_seconds = excluded.retention_window_seconds,
      expires_at = excluded.expires_at,
      updated_at = now()
  returning id into inserted_id;

  return query select 'upserted'::text, inserted_id;
end;
$$;

create or replace function public.delete_memory_task_memory(
  p_workspace_id uuid,
  p_task_id uuid,
  p_step_seq integer,
  p_output_key text
)
returns table (reason text, deleted_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_id uuid;
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

  delete from public.memory_task_memory
  where workspace_id = p_workspace_id
    and task_id = p_task_id
    and step_seq = p_step_seq
    and output_key = p_output_key
  returning id into deleted_id;

  if deleted_id is null then
    return query select 'task_memory_not_found'::text, null::uuid;
    return;
  end if;

  return query select 'deleted'::text, deleted_id;
end;
$$;

create or replace function public.upsert_memory_user_approved_fact(
  p_workspace_id uuid,
  p_fact_key text,
  p_fact_value_hash text,
  p_consent_record_id uuid,
  p_expires_at timestamptz default null
)
returns table (reason text, fact_id uuid)
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

  if p_fact_key is null or char_length(p_fact_key) = 0 then
    return query select 'invalid_fact_key'::text, null::uuid;
    return;
  end if;

  if p_fact_value_hash is null
     or p_fact_value_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_fact_value_hash'::text, null::uuid;
    return;
  end if;

  if p_consent_record_id is null
     or not exists (
       select 1 from public.memory_consent_records
       where id = p_consent_record_id
         and workspace_id = p_workspace_id
         and granted = true
         and revoked_at is null
     ) then
    return query select 'consent_not_found_or_revoked'::text, null::uuid;
    return;
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    return query select 'invalid_expires_at'::text, null::uuid;
    return;
  end if;

  insert into public.memory_user_approved_facts (
    workspace_id, fact_key, fact_value_hash, consent_record_id, expires_at
  )
  values (
    p_workspace_id, p_fact_key, p_fact_value_hash, p_consent_record_id,
    p_expires_at
  )
  on conflict (workspace_id, fact_key) do update
  set fact_value_hash = excluded.fact_value_hash,
      consent_record_id = excluded.consent_record_id,
      expires_at = excluded.expires_at,
      deleted_at = null,
      updated_at = now()
  returning id into inserted_id;

  return query select 'upserted'::text, inserted_id;
end;
$$;

create or replace function public.delete_memory_user_approved_fact(
  p_workspace_id uuid,
  p_fact_key text
)
returns table (reason text, deleted_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_id uuid;
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

  if p_fact_key is null or char_length(p_fact_key) = 0 then
    return query select 'invalid_fact_key'::text, null::uuid;
    return;
  end if;

  update public.memory_user_approved_facts
  set deleted_at = now(),
      updated_at = now()
  where workspace_id = p_workspace_id
    and fact_key = p_fact_key
    and deleted_at is null
  returning id into deleted_id;

  if deleted_id is null then
    return query select 'fact_not_found'::text, null::uuid;
    return;
  end if;

  return query select 'deleted'::text, deleted_id;
end;
$$;

create or replace function public.upsert_memory_external_data_ref(
  p_workspace_id uuid,
  p_ref_key text,
  p_ref_url text default null,
  p_ref_id text default null,
  p_revalidation_window_seconds integer
)
returns table (reason text, ref_id uuid)
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

  if p_ref_key is null or char_length(p_ref_key) = 0 then
    return query select 'invalid_ref_key'::text, null::uuid;
    return;
  end if;

  if p_ref_url is null and p_ref_id is null then
    return query select 'invalid_ref'::text, null::uuid;
    return;
  end if;

  if p_revalidation_window_seconds is null
     or p_revalidation_window_seconds not between 1 and 604800 then
    return query select 'invalid_revalidation_window_seconds'::text, null::uuid;
    return;
  end if;

  insert into public.memory_external_data_refs (
    workspace_id, ref_key, ref_url, ref_id,
    revalidation_window_seconds, expires_at
  )
  values (
    p_workspace_id, p_ref_key, p_ref_url, p_ref_id,
    p_revalidation_window_seconds,
    now() + (p_revalidation_window_seconds || ' seconds')::interval
  )
  on conflict (workspace_id, ref_key) do update
  set ref_url = excluded.ref_url,
      ref_id = excluded.ref_id,
      revalidation_window_seconds = excluded.revalidation_window_seconds,
      expires_at = excluded.expires_at,
      updated_at = now()
  returning id into inserted_id;

  return query select 'upserted'::text, inserted_id;
end;
$$;

create or replace function public.delete_memory_external_data_ref(
  p_workspace_id uuid,
  p_ref_key text
)
returns table (reason text, deleted_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_id uuid;
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

  if p_ref_key is null or char_length(p_ref_key) = 0 then
    return query select 'invalid_ref_key'::text, null::uuid;
    return;
  end if;

  delete from public.memory_external_data_refs
  where workspace_id = p_workspace_id
    and ref_key = p_ref_key
  returning id into deleted_id;

  if deleted_id is null then
    return query select 'external_data_ref_not_found'::text, null::uuid;
    return;
  end if;

  return query select 'deleted'::text, deleted_id;
end;
$$;

create or replace function public.record_memory_consent(
  p_workspace_id uuid,
  p_user_id uuid,
  p_consent_type text,
  p_granted boolean,
  p_evidence_hash text
)
returns table (reason text, consent_id uuid)
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

  if p_user_id is null
     or not exists (select 1 from auth.users where id = p_user_id) then
    return query select 'user_not_found'::text, null::uuid;
    return;
  end if;

  if p_consent_type is null
     or p_consent_type !~ '^[a-z][a-z0-9_]*$' then
    return query select 'invalid_consent_type'::text, null::uuid;
    return;
  end if;

  if p_evidence_hash is null
     or p_evidence_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid_evidence_hash'::text, null::uuid;
    return;
  end if;

  insert into public.memory_consent_records (
    workspace_id, user_id, consent_type, granted, evidence_hash
  )
  values (
    p_workspace_id, p_user_id, p_consent_type, p_granted, p_evidence_hash
  )
  on conflict (workspace_id, user_id, consent_type) do update
  set granted = excluded.granted,
      granted_at = now(),
      revoked_at = case when excluded.granted then null else now() end,
      evidence_hash = excluded.evidence_hash,
      created_at = now()
  returning id into inserted_id;

  return query select 'upserted'::text, inserted_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Least-privilege grants
-- ---------------------------------------------------------------------------

revoke all privileges on table
  public.memory_session_scratchpad,
  public.memory_task_memory,
  public.memory_user_approved_facts,
  public.memory_external_data_refs,
  public.memory_consent_records
from public, anon, authenticated;

grant select on table
  public.memory_session_scratchpad,
  public.memory_task_memory,
  public.memory_user_approved_facts,
  public.memory_external_data_refs,
  public.memory_consent_records
to authenticated;

grant select on table
  public.memory_session_scratchpad,
  public.memory_task_memory,
  public.memory_user_approved_facts,
  public.memory_external_data_refs,
  public.memory_consent_records
to service_role;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'nexa_memory_system'
  ) then
    create role nexa_memory_system nologin noinherit nobypassrls;
  end if;
end;
$$;

grant usage on schema public to nexa_memory_system;

grant select on table
  public.memory_session_scratchpad,
  public.memory_task_memory,
  public.memory_user_approved_facts,
  public.memory_external_data_refs,
  public.memory_consent_records
to nexa_memory_system;

revoke all on function public.upsert_memory_scratchpad(uuid, uuid, text, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.delete_memory_scratchpad(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.upsert_memory_task_memory(
  uuid, uuid, integer, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.delete_memory_task_memory(uuid, uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.upsert_memory_user_approved_fact(
  uuid, text, text, uuid, timestamptz
) from public, anon, authenticated;
revoke all on function public.delete_memory_user_approved_fact(uuid, text)
  from public, anon, authenticated;
revoke all on function public.upsert_memory_external_data_ref(
  uuid, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.delete_memory_external_data_ref(uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_memory_consent(uuid, uuid, text, boolean, text)
  from public, anon, authenticated;

grant execute on function public.upsert_memory_scratchpad(uuid, uuid, text, jsonb, integer)
  to service_role;
grant execute on function public.delete_memory_scratchpad(uuid, uuid, text)
  to service_role;
grant execute on function public.upsert_memory_task_memory(
  uuid, uuid, integer, text, text, text, text, integer
) to service_role;
grant execute on function public.delete_memory_task_memory(uuid, uuid, integer, text)
  to service_role;
grant execute on function public.upsert_memory_user_approved_fact(
  uuid, text, text, uuid, timestamptz
) to service_role;
grant execute on function public.delete_memory_user_approved_fact(uuid, text)
  to service_role;
grant execute on function public.upsert_memory_external_data_ref(
  uuid, text, text, text, integer
) to service_role;
grant execute on function public.delete_memory_external_data_ref(uuid, text)
  to service_role;
grant execute on function public.record_memory_consent(uuid, uuid, text, boolean, text)
  to service_role;

-- Rollback guidance: memory flag off leaves all memory reads empty and writes
-- denied; additive tables remain and no existing table, policy, grant,
-- trigger, or function is altered. Drop the RPCs before restoring any direct
-- write path.

commit;
