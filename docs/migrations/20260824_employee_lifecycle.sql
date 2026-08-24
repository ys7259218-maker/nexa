-- Additive lifecycle and per-employee automation kill switch.
-- Safe default: every employee starts paused. Existing legacy "Active" rows
-- are migrated to Paused and must pass the new activation checklist.
begin;

alter table public.ai_employees
  add column if not exists lifecycle_status text not null default 'Draft',
  add column if not exists automation_paused boolean not null default true,
  add column if not exists lifecycle_updated_at timestamptz not null default now();

update public.ai_employees
set lifecycle_status = case when status = 'Active' then 'Paused' else 'Draft' end,
    automation_paused = true,
    lifecycle_updated_at = now();

alter table public.ai_employees drop constraint if exists ai_employees_lifecycle_status_check;
alter table public.ai_employees add constraint ai_employees_lifecycle_status_check
  check (lifecycle_status in ('Draft', 'Testing', 'Active', 'Paused', 'Archived'));

alter table public.ai_employees drop constraint if exists ai_employees_active_not_paused_check;
alter table public.ai_employees add constraint ai_employees_active_not_paused_check
  check (lifecycle_status = 'Active' or automation_paused = true);

create index if not exists ai_employees_workspace_lifecycle_idx
  on public.ai_employees(workspace_id, lifecycle_status, created_at desc);

commit;
