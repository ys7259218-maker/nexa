-- Phase B milestone B6: model & inference abstraction (additive only).
--
-- This migration adds the `agent_usage_ledger` table for tenant-scoped
-- metering of model invocations. It does not alter any existing table,
-- policy, grant, trigger, or function.
--
-- Nothing here calls a model provider, WhatsApp, OAuth, the network, a
-- browser, the filesystem, or any calendar API. The table is inert until
-- the model layer feature flag is explicitly enabled outside production.
begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- agent_usage_ledger — append-only record of every model invocation for
-- tenant-scoped metering and budget ceiling enforcement.
create table if not exists public.agent_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid references public.agent_tasks(id) on delete set null,
  model text not null,
  provider text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  total_tokens integer not null,
  cost_estimate_usd numeric not null,
  duration_ms integer not null,
  created_at timestamptz not null default now(),
  constraint agent_usage_ledger_tokens_check check (
    total_tokens = input_tokens + output_tokens
  ),
  constraint agent_usage_ledger_cost_check check (cost_estimate_usd >= 0),
  constraint agent_usage_ledger_duration_check check (duration_ms >= 0),
  constraint agent_usage_ledger_workspace_id_id_key unique (workspace_id, id)
);

-- ---------------------------------------------------------------------------
-- 2. Row-level security: workspace-scoped reads only.
--    No client INSERT/UPDATE/DELETE policies on this table.
-- ---------------------------------------------------------------------------

alter table public.agent_usage_ledger enable row level security;

drop policy if exists "Agent usage ledger is readable by workspace members"
  on public.agent_usage_ledger;
create policy "Agent usage ledger is readable by workspace members"
  on public.agent_usage_ledger for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

create index if not exists agent_usage_ledger_workspace_idx
  on public.agent_usage_ledger (workspace_id, created_at desc);

create index if not exists agent_usage_ledger_task_idx
  on public.agent_usage_ledger (task_id);

commit;
