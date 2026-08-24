-- Immutable workspace audit history for employee lifecycle and safety changes.
-- Apply after workspace tenancy and employee lifecycle migrations.
begin;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('ai_employee', 'workspace', 'integration')),
  entity_id uuid,
  action text not null check (char_length(action) between 1 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;
create policy "Workspace members read audit history" on public.audit_events
  for select to authenticated using (public.is_workspace_member(workspace_id));
-- No client INSERT/UPDATE/DELETE policy. Trusted database triggers write rows.

create index if not exists audit_events_workspace_created_idx
  on public.audit_events(workspace_id, created_at desc);
create index if not exists audit_events_entity_idx
  on public.audit_events(workspace_id, entity_type, entity_id, created_at desc);

create or replace function public.audit_ai_employee_safety_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare event_action text;
begin
  if old.lifecycle_status is not distinct from new.lifecycle_status
     and old.automation_paused is not distinct from new.automation_paused then
    return new;
  end if;

  event_action := case
    when old.automation_paused = false and new.automation_paused = true then 'automation_paused'
    when old.lifecycle_status is distinct from new.lifecycle_status then 'lifecycle_changed'
    else 'automation_resumed'
  end;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    new.workspace_id,
    auth.uid(),
    'ai_employee',
    new.id,
    event_action,
    jsonb_build_object(
      'from_status', old.lifecycle_status,
      'to_status', new.lifecycle_status,
      'automation_paused', new.automation_paused
    )
  );
  return new;
end $$;

revoke all on function public.audit_ai_employee_safety_change() from public;

drop trigger if exists audit_ai_employee_safety_change on public.ai_employees;
create trigger audit_ai_employee_safety_change
after update of lifecycle_status, automation_paused on public.ai_employees
for each row execute function public.audit_ai_employee_safety_change();

commit;
