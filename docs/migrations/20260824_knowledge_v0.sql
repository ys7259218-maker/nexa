-- Structured per-employee Knowledge v0 with verified-only runtime use.
-- Apply after employee versions. Keep KNOWLEDGE_V0_ENABLED=false until this
-- migration and two-account RLS/role tests pass in a dedicated test project.
begin;

create unique index if not exists ai_employees_workspace_id_id_uidx
  on public.ai_employees(workspace_id, id);

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id()
    references public.workspaces(id) on delete cascade,
  ai_employee_id uuid not null,
  kind text not null check (kind in ('note', 'faq')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  question text not null default '' check (
    char_length(question) <= 500
    and (kind <> 'faq' or char_length(btrim(question)) between 1 and 500)
  ),
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  verified boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_entries_employee_workspace_fkey
    foreign key (workspace_id, ai_employee_id)
    references public.ai_employees(workspace_id, id) on delete cascade
);

alter table public.knowledge_entries enable row level security;
revoke all on table public.knowledge_entries from public, anon;
grant select, insert, update, delete on table public.knowledge_entries to authenticated;

drop policy if exists "Workspace members read knowledge entries" on public.knowledge_entries;
drop policy if exists "Workspace operators create knowledge entries" on public.knowledge_entries;
drop policy if exists "Workspace operators update knowledge entries" on public.knowledge_entries;
drop policy if exists "Workspace operators delete knowledge entries" on public.knowledge_entries;

create policy "Workspace members read knowledge entries" on public.knowledge_entries
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace operators create knowledge entries" on public.knowledge_entries
  for insert to authenticated with check (
    public.workspace_has_role(workspace_id, array['owner', 'admin', 'operator'])
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );
create policy "Workspace operators update knowledge entries" on public.knowledge_entries
  for update to authenticated
  using (public.workspace_has_role(workspace_id, array['owner', 'admin', 'operator']))
  with check (public.workspace_has_role(workspace_id, array['owner', 'admin', 'operator']));
create policy "Workspace operators delete knowledge entries" on public.knowledge_entries
  for delete to authenticated using (
    public.workspace_has_role(workspace_id, array['owner', 'admin', 'operator'])
  );

create index if not exists knowledge_entries_workspace_employee_updated_idx
  on public.knowledge_entries(workspace_id, ai_employee_id, updated_at desc);
create index if not exists knowledge_entries_verified_idx
  on public.knowledge_entries(workspace_id, ai_employee_id, updated_at desc)
  where verified;

create or replace function public.guard_knowledge_entry_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from auth.uid()
       or new.updated_by is distinct from auth.uid() then
      raise exception 'Knowledge entry actor cannot be forged';
    end if;
    new.created_at := now();
  else
    if old.workspace_id is distinct from new.workspace_id
       or old.ai_employee_id is distinct from new.ai_employee_id
       or old.created_by is distinct from new.created_by
       or old.created_at is distinct from new.created_at then
      raise exception 'Knowledge entry identity cannot be changed';
    end if;
  end if;

  new.title := btrim(new.title);
  new.question := btrim(new.question);
  new.content := btrim(new.content);
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.guard_knowledge_entry_write() from public;

drop trigger if exists guard_knowledge_entry_write on public.knowledge_entries;
create trigger guard_knowledge_entry_write
before insert or update on public.knowledge_entries
for each row execute function public.guard_knowledge_entry_write();

-- Creation derives workspace identity from the already-authorized employee so
-- Operator users do not depend on the owner-only current_workspace_id default.
create or replace function public.create_knowledge_entry(
  target_employee_id uuid,
  target_kind text,
  target_title text,
  target_question text,
  target_content text,
  target_verified boolean
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  employee public.ai_employees%rowtype;
  created public.knowledge_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into employee from public.ai_employees where id = target_employee_id;
  if not found or not public.workspace_has_role(
    employee.workspace_id,
    array['owner', 'admin', 'operator']
  ) then
    raise exception 'Knowledge entry cannot be created';
  end if;

  insert into public.knowledge_entries (
    workspace_id, ai_employee_id, kind, title, question, content, verified,
    created_by, updated_by
  ) values (
    employee.workspace_id, employee.id, target_kind, target_title,
    coalesce(target_question, ''), target_content, coalesce(target_verified, false),
    auth.uid(), auth.uid()
  ) returning * into created;

  return to_jsonb(created);
end $$;
revoke all on function public.create_knowledge_entry(uuid, text, text, text, text, boolean) from public;
grant execute on function public.create_knowledge_entry(uuid, text, text, text, text, boolean) to authenticated;

create or replace function public.audit_knowledge_entry_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  entry public.knowledge_entries%rowtype;
  event_action text;
begin
  if tg_op = 'DELETE' then
    entry := old;
  else
    entry := new;
  end if;
  event_action := case tg_op
    when 'INSERT' then 'knowledge_entry_created'
    when 'UPDATE' then 'knowledge_entry_updated'
    else 'knowledge_entry_deleted'
  end;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    entry.workspace_id,
    auth.uid(),
    'ai_employee',
    entry.ai_employee_id,
    event_action,
    jsonb_build_object(
      'knowledge_entry_id', entry.id,
      'kind', entry.kind,
      'verified', entry.verified
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;
revoke all on function public.audit_knowledge_entry_change() from public;

drop trigger if exists audit_knowledge_entry_change on public.knowledge_entries;
create trigger audit_knowledge_entry_change
after insert or update or delete on public.knowledge_entries
for each row execute function public.audit_knowledge_entry_change();

commit;
