-- Workspace-wide automation kill switch. Apply after audit_events migration.
begin;

alter table public.workspaces
  add column if not exists automation_paused boolean not null default true,
  add column if not exists safety_updated_at timestamptz not null default now();

create policy "Workspace admins update safety controls" on public.workspaces
  for update to authenticated
  using (public.workspace_has_role(id, array['owner','admin']))
  with check (public.workspace_has_role(id, array['owner','admin']));

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

commit;
