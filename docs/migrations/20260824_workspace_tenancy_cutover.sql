-- Nexa Phase 1: workspace tenancy cutover.
-- Prerequisite: run "Workspace tenancy foundation" from SUPABASE_SETUP.md.
-- Back up production before running. This migration fails before policy changes
-- if any existing row cannot be mapped to a workspace.

begin;

create or replace function public.current_workspace_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select workspace_id from public.workspace_members
  where user_id = (select auth.uid())
  order by created_at asc limit 1
$$;

create or replace function public.workspace_has_role(target_workspace_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and role = any(allowed_roles)
  )
$$;

revoke all on function public.current_workspace_id() from public;
revoke all on function public.workspace_has_role(uuid, text[]) from public;
grant execute on function public.current_workspace_id() to authenticated;
grant execute on function public.workspace_has_role(uuid, text[]) to authenticated;

alter table public.ai_employees add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.calls add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.appointments add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.activity_events add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.whatsapp_channels add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.conversations add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.messages add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

update public.ai_employees target set workspace_id = (select workspace_id from public.workspace_members where user_id = target.user_id order by created_at limit 1)
where target.workspace_id is null;
update public.calls target set workspace_id = (select workspace_id from public.workspace_members where user_id = target.user_id order by created_at limit 1)
where target.workspace_id is null;
update public.appointments target set workspace_id = (select workspace_id from public.workspace_members where user_id = target.user_id order by created_at limit 1)
where target.workspace_id is null;
update public.activity_events target set workspace_id = (select workspace_id from public.workspace_members where user_id = target.user_id order by created_at limit 1)
where target.workspace_id is null;
update public.whatsapp_channels target set workspace_id = (select workspace_id from public.workspace_members where user_id = target.user_id order by created_at limit 1)
where target.workspace_id is null;
update public.conversations target set workspace_id = (select workspace_id from public.workspace_members where user_id = target.user_id order by created_at limit 1)
where target.workspace_id is null;
update public.messages target set workspace_id = (select workspace_id from public.workspace_members where user_id = target.user_id order by created_at limit 1)
where target.workspace_id is null;

do $$
declare missing_rows bigint;
begin
  select
    (select count(*) from public.ai_employees where workspace_id is null) +
    (select count(*) from public.calls where workspace_id is null) +
    (select count(*) from public.appointments where workspace_id is null) +
    (select count(*) from public.activity_events where workspace_id is null) +
    (select count(*) from public.whatsapp_channels where workspace_id is null) +
    (select count(*) from public.conversations where workspace_id is null) +
    (select count(*) from public.messages where workspace_id is null)
  into missing_rows;
  if missing_rows > 0 then
    raise exception 'Workspace backfill incomplete: % rows are unmapped', missing_rows;
  end if;
end $$;

alter table public.ai_employees alter column workspace_id set default public.current_workspace_id(), alter column workspace_id set not null;
alter table public.calls alter column workspace_id set default public.current_workspace_id(), alter column workspace_id set not null;
alter table public.appointments alter column workspace_id set default public.current_workspace_id(), alter column workspace_id set not null;
alter table public.activity_events alter column workspace_id set default public.current_workspace_id(), alter column workspace_id set not null;
alter table public.whatsapp_channels alter column workspace_id set default public.current_workspace_id(), alter column workspace_id set not null;
alter table public.conversations alter column workspace_id set default public.current_workspace_id(), alter column workspace_id set not null;
alter table public.messages alter column workspace_id set not null;

create index if not exists ai_employees_workspace_idx on public.ai_employees(workspace_id, created_at desc);
create index if not exists calls_workspace_idx on public.calls(workspace_id, created_at desc);
create index if not exists appointments_workspace_idx on public.appointments(workspace_id, scheduled_at);
create index if not exists activity_events_workspace_idx on public.activity_events(workspace_id, created_at desc);
create index if not exists whatsapp_channels_workspace_idx on public.whatsapp_channels(workspace_id);
create index if not exists conversations_workspace_idx on public.conversations(workspace_id, last_message_at desc);
create index if not exists messages_workspace_idx on public.messages(workspace_id, conversation_id, created_at);
create unique index if not exists conversations_workspace_customer_uidx on public.conversations(workspace_id, customer_wa_id);

-- Replace legacy owner policies only after the guarded backfill succeeds.
drop policy if exists "Users read their own AI employees" on public.ai_employees;
drop policy if exists "Users create their own AI employees" on public.ai_employees;
drop policy if exists "Users update their own AI employees" on public.ai_employees;
drop policy if exists "Users delete their own AI employees" on public.ai_employees;
drop policy if exists "Workspace members read AI employees" on public.ai_employees;
drop policy if exists "Workspace operators create AI employees" on public.ai_employees;
drop policy if exists "Workspace operators update AI employees" on public.ai_employees;
drop policy if exists "Workspace admins delete AI employees" on public.ai_employees;
create policy "Workspace members read AI employees" on public.ai_employees for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace operators create AI employees" on public.ai_employees for insert to authenticated with check (public.workspace_has_role(workspace_id, array['owner','admin','operator']));
create policy "Workspace operators update AI employees" on public.ai_employees for update to authenticated using (public.workspace_has_role(workspace_id, array['owner','admin','operator'])) with check (public.workspace_has_role(workspace_id, array['owner','admin','operator']));
create policy "Workspace admins delete AI employees" on public.ai_employees for delete to authenticated using (public.workspace_has_role(workspace_id, array['owner','admin']));

drop policy if exists "Users read their own calls" on public.calls;
drop policy if exists "Users insert their own calls" on public.calls;
drop policy if exists "Workspace members read calls" on public.calls;
drop policy if exists "Workspace operators insert calls" on public.calls;
create policy "Workspace members read calls" on public.calls for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace operators insert calls" on public.calls for insert to authenticated with check (public.workspace_has_role(workspace_id, array['owner','admin','operator']));

drop policy if exists "Users read their own appointments" on public.appointments;
drop policy if exists "Users insert their own appointments" on public.appointments;
drop policy if exists "Users update their own appointments" on public.appointments;
drop policy if exists "Workspace members read appointments" on public.appointments;
drop policy if exists "Workspace operators insert appointments" on public.appointments;
drop policy if exists "Workspace operators update appointments" on public.appointments;
create policy "Workspace members read appointments" on public.appointments for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace operators insert appointments" on public.appointments for insert to authenticated with check (public.workspace_has_role(workspace_id, array['owner','admin','operator']));
create policy "Workspace operators update appointments" on public.appointments for update to authenticated using (public.workspace_has_role(workspace_id, array['owner','admin','operator'])) with check (public.workspace_has_role(workspace_id, array['owner','admin','operator']));

drop policy if exists "Users read their own activity" on public.activity_events;
drop policy if exists "Users insert their own activity" on public.activity_events;
drop policy if exists "Workspace members read activity" on public.activity_events;
drop policy if exists "Workspace operators insert activity" on public.activity_events;
create policy "Workspace members read activity" on public.activity_events for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace operators insert activity" on public.activity_events for insert to authenticated with check (public.workspace_has_role(workspace_id, array['owner','admin','operator']));

drop policy if exists "Owners manage their WhatsApp channels" on public.whatsapp_channels;
drop policy if exists "Workspace admins manage WhatsApp channels" on public.whatsapp_channels;
create policy "Workspace admins manage WhatsApp channels" on public.whatsapp_channels for all to authenticated using (public.workspace_has_role(workspace_id, array['owner','admin'])) with check (public.workspace_has_role(workspace_id, array['owner','admin']));

drop policy if exists "Owners read their conversations" on public.conversations;
drop policy if exists "Owners read their messages" on public.messages;
drop policy if exists "Workspace members read conversations" on public.conversations;
drop policy if exists "Workspace members read messages" on public.messages;
create policy "Workspace members read conversations" on public.conversations for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members read messages" on public.messages for select to authenticated using (public.is_workspace_member(workspace_id));

commit;
