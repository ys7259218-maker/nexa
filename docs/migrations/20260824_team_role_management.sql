-- Owner/Admin role management. Apply after workspace tenancy cutover.
begin;

create or replace function public.workspace_role(target_workspace_id uuid)
returns text language sql stable security definer set search_path = public
as $$ select role from public.workspace_members where workspace_id = target_workspace_id and user_id = auth.uid() $$;
revoke all on function public.workspace_role(uuid) from public;
grant execute on function public.workspace_role(uuid) to authenticated;

create policy "Workspace admins update member roles" on public.workspace_members
  for update to authenticated
  using (public.workspace_has_role(workspace_id, array['owner','admin']))
  with check (public.workspace_has_role(workspace_id, array['owner','admin']));

-- Protect the final owner and prevent Admin users from granting/removing Owner.
create or replace function public.guard_workspace_role_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare actor_role text; owner_count integer;
begin
  actor_role := public.workspace_role(old.workspace_id);
  if old.workspace_id <> new.workspace_id or old.user_id <> new.user_id then
    raise exception 'Membership identity cannot be changed';
  end if;
  if actor_role <> 'owner' and (old.role = 'owner' or new.role = 'owner') then
    raise exception 'Only an owner can change owner membership';
  end if;
  if old.role = 'owner' and new.role <> 'owner' then
    select count(*) into owner_count from public.workspace_members where workspace_id = old.workspace_id and role = 'owner';
    if owner_count <= 1 then raise exception 'A workspace must retain an owner'; end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_workspace_role_change() from public;

drop trigger if exists guard_workspace_role_change on public.workspace_members;
create trigger guard_workspace_role_change before update on public.workspace_members
for each row execute function public.guard_workspace_role_change();

commit;
