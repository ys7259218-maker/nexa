-- Additive lifecycle and per-employee automation kill switch.
-- Safe default: every employee starts paused. Existing legacy "Active" rows
-- are migrated to Paused and must pass the new activation checklist.
begin;

alter table public.ai_employees
  add column if not exists lifecycle_status text not null default 'Draft',
  add column if not exists automation_paused boolean not null default true,
  add column if not exists lifecycle_updated_at timestamptz not null default now();

-- Backfill once. On a rerun the guard trigger already exists, so valid
-- lifecycle state must be preserved instead of silently resetting employees.
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.ai_employees'::regclass
      and tgname = 'guard_ai_employee_lifecycle_insert'
      and not tgisinternal
  ) then
    update public.ai_employees
    set lifecycle_status = case when status = 'Active' then 'Paused' else 'Draft' end,
        automation_paused = true,
        lifecycle_updated_at = now();
  end if;
end $$;

alter table public.ai_employees drop constraint if exists ai_employees_lifecycle_status_check;
alter table public.ai_employees add constraint ai_employees_lifecycle_status_check
  check (lifecycle_status in ('Draft', 'Testing', 'Active', 'Paused', 'Archived'));

alter table public.ai_employees drop constraint if exists ai_employees_active_not_paused_check;
alter table public.ai_employees add constraint ai_employees_active_not_paused_check
  check (lifecycle_status = 'Active' or automation_paused = true);

create index if not exists ai_employees_workspace_lifecycle_idx
  on public.ai_employees(workspace_id, lifecycle_status, created_at desc);

-- Trusted runtime checks write this row after verifying channel/runtime state.
-- There are deliberately no client policies: Active must fail closed when the
-- evidence row is absent, stale, or incomplete.
create table if not exists public.ai_employee_activation_evidence (
  ai_employee_id uuid primary key references public.ai_employees(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_linked boolean not null default false,
  webhook_configured boolean not null default false,
  inbound_ready boolean not null default false,
  outbound_enabled boolean not null default false,
  verified_at timestamptz not null default now(),
  verified_by uuid references auth.users(id) on delete set null,
  unique (ai_employee_id, workspace_id)
);
alter table public.ai_employee_activation_evidence enable row level security;

-- Protected lifecycle columns may only be changed by the narrow functions
-- below. This also catches older clients that still attempt a generic update.
create or replace function public.guard_ai_employee_lifecycle_write()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.lifecycle_status <> 'Draft' or new.automation_paused is distinct from true then
      raise exception 'New AI employees must start Draft and paused';
    end if;
    return new;
  end if;
  if old.lifecycle_status is distinct from new.lifecycle_status
     or old.automation_paused is distinct from new.automation_paused
     or old.lifecycle_updated_at is distinct from new.lifecycle_updated_at then
    if coalesce(current_setting('nexa.lifecycle_write', true), '') <> 'allowed' then
      raise exception 'Lifecycle controls must be changed through the approved RPC';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_ai_employee_lifecycle_write() from public;

drop trigger if exists guard_ai_employee_lifecycle_write on public.ai_employees;
create trigger guard_ai_employee_lifecycle_write
before update of lifecycle_status, automation_paused, lifecycle_updated_at on public.ai_employees
for each row execute function public.guard_ai_employee_lifecycle_write();
drop trigger if exists guard_ai_employee_lifecycle_insert on public.ai_employees;
create trigger guard_ai_employee_lifecycle_insert
before insert on public.ai_employees
for each row execute function public.guard_ai_employee_lifecycle_write();

create or replace function public.transition_ai_employee_lifecycle(
  target_employee_id uuid,
  target_status text
)
returns public.ai_employees
language plpgsql security definer set search_path = public
as $$
declare employee public.ai_employees; evidence_ready boolean; result public.ai_employees;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into employee from public.ai_employees
  where id = target_employee_id for update;
  if not found then raise exception 'AI employee not found'; end if;
  if not public.workspace_has_role(employee.workspace_id, array['owner','admin','operator']) then
    raise exception 'Insufficient workspace role';
  end if;
  if target_status not in ('Draft', 'Testing', 'Active', 'Paused', 'Archived') then
    raise exception 'Invalid lifecycle status';
  end if;
  if not (
    (employee.lifecycle_status = 'Draft' and target_status in ('Testing','Archived')) or
    (employee.lifecycle_status = 'Testing' and target_status in ('Draft','Active','Paused')) or
    (employee.lifecycle_status = 'Active' and target_status = 'Paused') or
    (employee.lifecycle_status = 'Paused' and target_status in ('Testing','Active','Archived')) or
    (employee.lifecycle_status = 'Archived' and target_status = 'Draft')
  ) then raise exception 'Lifecycle transition is not allowed'; end if;

  if target_status = 'Active' then
    select exists (
      select 1 from public.ai_employee_activation_evidence e
      where e.ai_employee_id = employee.id
        and e.workspace_id = employee.workspace_id
        and e.channel_linked and e.webhook_configured
        and e.inbound_ready and e.outbound_enabled
        and e.verified_at >= now() - interval '24 hours'
    ) into evidence_ready;
    if not evidence_ready
       or btrim(employee.name) = '' or btrim(employee.business_name) = ''
       or btrim(employee.department) = '' or btrim(employee.business_description) = ''
       or btrim(employee.greeting_message) = '' or btrim(employee.timezone) = ''
       or btrim(employee.working_hours) = '' or btrim(employee.language) = ''
       or btrim(employee.voice) = ''
       or not (btrim(employee.knowledge_website) <> ''
               or btrim(employee.knowledge_faq_document) <> ''
               or btrim(employee.knowledge_pdf_url) <> ''
               or btrim(employee.knowledge_notes) <> '') then
      raise exception 'Activation requirements are incomplete or stale';
    end if;
  end if;

  perform set_config('nexa.lifecycle_write', 'allowed', true);
  update public.ai_employees set
    lifecycle_status = target_status,
    automation_paused = (target_status <> 'Active'),
    lifecycle_updated_at = now()
  where id = employee.id returning * into result;
  return result;
end $$;
revoke all on function public.transition_ai_employee_lifecycle(uuid, text) from public;
grant execute on function public.transition_ai_employee_lifecycle(uuid, text) to authenticated;

create or replace function public.set_ai_employee_automation_paused(
  target_employee_id uuid,
  paused boolean
)
returns public.ai_employees
language plpgsql security definer set search_path = public
as $$
declare employee public.ai_employees; result public.ai_employees;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into employee from public.ai_employees
  where id = target_employee_id for update;
  if not found then raise exception 'AI employee not found'; end if;
  if not public.workspace_has_role(employee.workspace_id, array['owner','admin','operator']) then
    raise exception 'Insufficient workspace role';
  end if;
  if not paused and employee.lifecycle_status <> 'Active' then
    raise exception 'Only an Active employee can resume automation';
  end if;
  perform set_config('nexa.lifecycle_write', 'allowed', true);
  update public.ai_employees set automation_paused = paused, lifecycle_updated_at = now()
  where id = employee.id returning * into result;
  return result;
end $$;
revoke all on function public.set_ai_employee_automation_paused(uuid, boolean) from public;
grant execute on function public.set_ai_employee_automation_paused(uuid, boolean) to authenticated;

-- Rollback guidance: revoke both RPCs, drop the guard trigger/functions and
-- evidence table, then (only during a controlled rollback) restore direct
-- lifecycle writes. Keep the columns/data so rollback does not lose state.

commit;
