-- Phase B milestone B7: browser integration (additive only).
--
-- This migration adds exactly one table, `agent_browser_sessions`, for
-- tenant-scoped session records. It does not alter any existing table,
-- policy, grant, trigger, or function.
--
-- The table stores references and hashes only. It never stores page content,
-- screenshots, DOM snapshots, cookies, credentials or downloaded bytes.
--
-- Nothing here calls a browser, a network socket, a provider, WhatsApp,
-- OAuth, the filesystem, or any calendar API. The table is inert until the
-- browser feature flag is explicitly enabled outside production.
begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

-- agent_browser_sessions — one row per disposable browser session. Rows are
-- append-only from the client's perspective: there is no client INSERT,
-- UPDATE or DELETE policy.
create table if not exists public.agent_browser_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  session_ref text not null,
  policy_hash text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  teardown_status text not null default 'pending',
  evidence_refs text[] not null default '{}',
  constraint agent_browser_sessions_policy_hash_check check (
    policy_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint agent_browser_sessions_teardown_status_check check (
    teardown_status in ('pending', 'closed', 'teardown_failed', 'aborted')
  ),
  constraint agent_browser_sessions_ended_at_check check (
    ended_at is null or ended_at >= started_at
  ),
  constraint agent_browser_sessions_workspace_ref_key unique (
    workspace_id,
    session_ref
  )
);

-- ---------------------------------------------------------------------------
-- 2. Row-level security: workspace-scoped reads only.
--    No client INSERT/UPDATE/DELETE policies on this table.
-- ---------------------------------------------------------------------------

alter table public.agent_browser_sessions enable row level security;

drop policy if exists "Agent browser sessions are readable by workspace members"
  on public.agent_browser_sessions;
create policy "Agent browser sessions are readable by workspace members"
  on public.agent_browser_sessions for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

create index if not exists agent_browser_sessions_workspace_idx
  on public.agent_browser_sessions (workspace_id, started_at desc);

create index if not exists agent_browser_sessions_task_idx
  on public.agent_browser_sessions (task_id);

commit;
