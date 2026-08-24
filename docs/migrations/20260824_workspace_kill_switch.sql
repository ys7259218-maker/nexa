-- Workspace-wide automation kill switch. Apply after audit_events migration.
begin;

alter table public.workspaces
  add column if not exists automation_paused boolean not null default true,
  add column if not exists safety_updated_at timestamptz not null default now();

-- Do not add a table UPDATE policy here: a row policy cannot restrict which
-- columns are changed. The SECURITY DEFINER RPC below is the only client path.
drop policy if exists "Workspace admins update safety controls" on public.workspaces;

create or replace function public.guard_workspace_safety_write()
returns trigger language plpgsql set search_path = public
as $$
begin
  if old.automation_paused is distinct from new.automation_paused
     and coalesce(current_setting('nexa.workspace_safety_write', true), '') <> 'allowed' then
    raise exception 'Workspace safety must be changed through the approved RPC';
  end if;
  return new;
end $$;
revoke all on function public.guard_workspace_safety_write() from public;

drop trigger if exists guard_workspace_safety_write on public.workspaces;
create trigger guard_workspace_safety_write
before update of automation_paused on public.workspaces
for each row execute function public.guard_workspace_safety_write();

create or replace function public.set_workspace_automation_paused(
  target_workspace_id uuid,
  paused boolean
)
returns public.workspaces
language plpgsql security definer set search_path = public
as $$
declare result public.workspaces;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.workspace_has_role(target_workspace_id, array['owner','admin']) then
    raise exception 'Insufficient workspace role';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_workspace_id::text, 0));
  perform set_config('nexa.workspace_safety_write', 'allowed', true);
  update public.workspaces set automation_paused = paused
  where id = target_workspace_id returning * into result;
  if not found then raise exception 'Workspace not found'; end if;
  return result;
end $$;
revoke all on function public.set_workspace_automation_paused(uuid, boolean) from public;
grant execute on function public.set_workspace_automation_paused(uuid, boolean) to authenticated;

create or replace function public.audit_workspace_safety_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.automation_paused is not distinct from new.automation_paused then return new; end if;
  new.safety_updated_at := now();
  insert into public.audit_events (workspace_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (new.id, auth.uid(), 'workspace', new.id,
    case when new.automation_paused then 'workspace_automation_paused' else 'workspace_automation_resumed' end,
    jsonb_build_object('automation_paused', new.automation_paused));
  return new;
end $$;
revoke all on function public.audit_workspace_safety_change() from public;

drop trigger if exists audit_workspace_safety_change on public.workspaces;
create trigger audit_workspace_safety_change
before update of automation_paused on public.workspaces
for each row execute function public.audit_workspace_safety_change();

-- Rollback guidance: revoke/drop set_workspace_automation_paused and its guard
-- trigger before restoring any direct UPDATE policy. Retain the paused column
-- and audit rows so a rollback cannot silently resume automation or erase history.

commit;
