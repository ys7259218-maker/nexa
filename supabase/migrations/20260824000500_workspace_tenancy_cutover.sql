-- Nexa Phase 1: workspace tenancy cutover.
-- Prerequisite: run 20260824_workspace_tenancy_foundation.sql.
-- Back up production before running. This migration fails before policy changes
-- if any existing row cannot be mapped to a workspace.

begin;

create or replace function public.current_workspace_id()
returns uuid language sql stable security definer set search_path = pg_catalog, public
as $$
  select w.id
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  where w.created_by = (select auth.uid())
    and w.is_personal
    and m.user_id = (select auth.uid())
    and m.role = 'owner'
$$;

create or replace function public.workspace_has_role(target_workspace_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = pg_catalog, public
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

-- All target tables must already be protected. Only the exact reviewed legacy
-- policy names (or names created by this cutover) are tolerated; a permissive
-- policy with any other name would OR with the workspace policies.
do $$
declare unprotected_tables text; unexpected_policies text;
begin
  select string_agg(target.table_name, ', ' order by target.table_name)
  into unprotected_tables
  from unnest(array['ai_employees','calls','appointments','activity_events','whatsapp_channels','conversations','messages']) target(table_name)
  join pg_class c on c.oid=format('public.%I',target.table_name)::regclass
  where not c.relrowsecurity;
  if unprotected_tables is not null then
    raise exception 'Workspace cutover requires RLS before changes on: %',unprotected_tables;
  end if;

  with allowed(table_name,policy_name) as (values
    ('ai_employees','Users read their own AI employees'),('ai_employees','Users create their own AI employees'),
    ('ai_employees','Users update their own AI employees'),('ai_employees','Users delete their own AI employees'),
    ('ai_employees','Workspace members read AI employees'),('ai_employees','Workspace operators create AI employees'),
    ('ai_employees','Workspace operators update AI employees'),('ai_employees','Workspace admins delete AI employees'),
    ('calls','Users read their own calls'),('calls','Users insert their own calls'),
    ('calls','Workspace members read calls'),('calls','Workspace operators insert calls'),
    ('appointments','Users read their own appointments'),('appointments','Users insert their own appointments'),
    ('appointments','Users update their own appointments'),('appointments','Workspace members read appointments'),
    ('appointments','Workspace operators insert appointments'),('appointments','Workspace operators update appointments'),
    ('activity_events','Users read their own activity'),('activity_events','Users insert their own activity'),
    ('activity_events','Workspace members read activity'),('activity_events','Workspace operators insert activity'),
    ('whatsapp_channels','Owners manage their WhatsApp channels'),('whatsapp_channels','Workspace admins manage WhatsApp channels'),
    ('conversations','Owners read their conversations'),('conversations','Workspace members read conversations'),
    ('messages','Owners read their messages'),('messages','Workspace members read messages')
  )
  select string_agg(format('%I.%I',p.tablename,p.policyname),', ' order by p.tablename,p.policyname)
  into unexpected_policies
  from pg_policies p
  where p.schemaname='public'
    and p.tablename in ('ai_employees','calls','appointments','activity_events','whatsapp_channels','conversations','messages')
    and not exists(select 1 from allowed a where a.table_name=p.tablename and a.policy_name=p.policyname);
  if unexpected_policies is not null then
    raise exception 'Workspace cutover blocked by unexpected RLS policies: %',unexpected_policies;
  end if;
end $$;

alter table public.ai_employees add column if not exists workspace_id uuid;
alter table public.calls add column if not exists workspace_id uuid;
alter table public.appointments add column if not exists workspace_id uuid;
alter table public.activity_events add column if not exists workspace_id uuid;
alter table public.whatsapp_channels add column if not exists workspace_id uuid;
alter table public.conversations add column if not exists workspace_id uuid;
alter table public.messages add column if not exists workspace_id uuid;

-- A same-named/incompatible column or composite/unvalidated FK must not pass an
-- IF NOT EXISTS migration. This is a one-time cutover, so workspace_id must be
-- nullable with no default at this phase.
do $$
declare target_table text; invalid_fks bigint; canonical_fk text;
begin
  foreach target_table in array array['ai_employees','calls','appointments','activity_events','whatsapp_channels','conversations','messages'] loop
    if not exists(select 1 from information_schema.columns
      where table_schema='public' and table_name=target_table and column_name='workspace_id'
        and udt_name='uuid' and is_nullable='YES' and column_default is null)
    then raise exception '%.workspace_id is incompatible or cutover was already applied',target_table; end if;

    select count(*) into invalid_fks from pg_constraint c
    where c.conrelid=format('public.%I',target_table)::regclass and c.contype='f'
      and (select a.attnum from pg_attribute a where a.attrelid=c.conrelid and a.attname='workspace_id')=any(c.conkey)
      and not (c.confrelid='public.workspaces'::regclass and c.confdeltype='c'
        and cardinality(c.conkey)=1 and cardinality(c.confkey)=1 and c.convalidated and not c.condeferrable
        and (select a.attname from pg_attribute a where a.attrelid=c.confrelid and a.attnum=c.confkey[1])='id');
    if invalid_fks<>0 then raise exception '%.workspace_id has an incompatible foreign key',target_table; end if;

    if not exists(select 1 from pg_constraint c
      where c.conrelid=format('public.%I',target_table)::regclass and c.contype='f'
        and c.confrelid='public.workspaces'::regclass and c.confdeltype='c'
        and cardinality(c.conkey)=1 and cardinality(c.confkey)=1 and c.convalidated and not c.condeferrable
        and (select a.attname from pg_attribute a where a.attrelid=c.conrelid and a.attnum=c.conkey[1])='workspace_id'
        and (select a.attname from pg_attribute a where a.attrelid=c.confrelid and a.attnum=c.confkey[1])='id')
    then
      canonical_fk:=target_table||'_workspace_id_fkey_v2';
      execute format('alter table public.%I add constraint %I foreign key (workspace_id) references public.workspaces(id) on delete cascade',target_table,canonical_fk);
    end if;
  end loop;
end $$;

-- Abort unless the foundation produced exactly one explicit creator-owned,
-- owner-only personal workspace per account. Shared memberships are never a
-- fallback for legacy private rows.
do $$
declare invalid_users bigint; mismatched_rows bigint;
begin
  select count(*) into invalid_users from auth.users account where (
    select count(*) from public.workspaces w
    join public.workspace_members m on m.workspace_id=w.id
    where w.created_by=account.id and w.is_personal
      and m.user_id=account.id and m.role='owner'
      and not exists(select 1 from public.workspace_members other where other.workspace_id=w.id and other.user_id<>account.id)
  )<>1;
  if invalid_users<>0 then raise exception 'Workspace cutover blocked: % accounts lack one safe personal mapping',invalid_users; end if;

  select
    (select count(*) from public.ai_employees t join public.workspaces w on w.id=t.workspace_id where t.workspace_id is not null and (not w.is_personal or w.created_by<>t.user_id))+
    (select count(*) from public.calls t join public.workspaces w on w.id=t.workspace_id where t.workspace_id is not null and (not w.is_personal or w.created_by<>t.user_id))+
    (select count(*) from public.appointments t join public.workspaces w on w.id=t.workspace_id where t.workspace_id is not null and (not w.is_personal or w.created_by<>t.user_id))+
    (select count(*) from public.activity_events t join public.workspaces w on w.id=t.workspace_id where t.workspace_id is not null and (not w.is_personal or w.created_by<>t.user_id))+
    (select count(*) from public.whatsapp_channels t join public.workspaces w on w.id=t.workspace_id where t.workspace_id is not null and (not w.is_personal or w.created_by<>t.user_id))+
    (select count(*) from public.conversations t join public.workspaces w on w.id=t.workspace_id where t.workspace_id is not null and (not w.is_personal or w.created_by<>t.user_id))+
    (select count(*) from public.messages t join public.workspaces w on w.id=t.workspace_id where t.workspace_id is not null and (not w.is_personal or w.created_by<>t.user_id))
  into mismatched_rows;
  if mismatched_rows<>0 then raise exception 'Workspace cutover blocked: % pre-mapped rows are not in their creator personal workspace',mismatched_rows; end if;
end $$;

update public.ai_employees target set workspace_id=w.id from public.workspaces w
where target.workspace_id is null and w.created_by=target.user_id and w.is_personal;
update public.calls target set workspace_id=w.id from public.workspaces w
where target.workspace_id is null and w.created_by=target.user_id and w.is_personal;
update public.appointments target set workspace_id=w.id from public.workspaces w
where target.workspace_id is null and w.created_by=target.user_id and w.is_personal;
update public.activity_events target set workspace_id=w.id from public.workspaces w
where target.workspace_id is null and w.created_by=target.user_id and w.is_personal;
update public.whatsapp_channels target set workspace_id=w.id from public.workspaces w
where target.workspace_id is null and w.created_by=target.user_id and w.is_personal;
update public.conversations target set workspace_id=w.id from public.workspaces w
where target.workspace_id is null and w.created_by=target.user_id and w.is_personal;
update public.messages target set workspace_id=w.id from public.workspaces w
where target.workspace_id is null and w.created_by=target.user_id and w.is_personal;

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

-- Tenant identity is immutable through ordinary row updates. A future transfer
-- workflow must be a separately reviewed, privileged, audited RPC rather than
-- a broad client UPDATE that can move private data between workspaces.
create or replace function public.protect_tenant_row_identity()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if old.workspace_id is distinct from new.workspace_id
     or old.user_id is distinct from new.user_id then
    raise exception 'Tenant row identity is immutable';
  end if;
  return new;
end $$;
revoke all on function public.protect_tenant_row_identity() from public,anon,authenticated;

do $$ declare target_table text; begin
  foreach target_table in array array['ai_employees','calls','appointments','activity_events','whatsapp_channels','conversations','messages'] loop
    execute format('drop trigger if exists protect_tenant_row_identity on public.%I',target_table);
    execute format('create trigger protect_tenant_row_identity before update of workspace_id,user_id on public.%I for each row execute function public.protect_tenant_row_identity()',target_table);
  end loop;
end $$;

create index if not exists ai_employees_workspace_idx on public.ai_employees(workspace_id, created_at desc);
create index if not exists calls_workspace_idx on public.calls(workspace_id, created_at desc);
create index if not exists appointments_workspace_idx on public.appointments(workspace_id, scheduled_at);
create index if not exists activity_events_workspace_idx on public.activity_events(workspace_id, created_at desc);
create index if not exists whatsapp_channels_workspace_idx on public.whatsapp_channels(workspace_id);
create index if not exists conversations_workspace_idx on public.conversations(workspace_id, last_message_at desc);
create index if not exists messages_workspace_idx on public.messages(workspace_id, conversation_id, created_at);

do $$ begin
  if to_regclass('public.conversations_workspace_customer_uidx') is not null
     and not exists(select 1 from pg_index i
       where i.indexrelid=to_regclass('public.conversations_workspace_customer_uidx')
         and i.indrelid='public.conversations'::regclass and i.indisunique and i.indisvalid
         and i.indnkeyatts=2 and i.indnatts=2 and i.indpred is null
         and (select array_agg(a.attname order by key.ord)
              from unnest(i.indkey) with ordinality key(attnum,ord)
              join pg_attribute a on a.attrelid=i.indrelid and a.attnum=key.attnum)
             =array['workspace_id','customer_wa_id']::name[])
  then raise exception 'Existing conversations workspace/customer index is incompatible'; end if;
end $$;
create unique index if not exists conversations_workspace_customer_uidx on public.conversations(workspace_id, customer_wa_id);

-- Remove the legacy user-scoped conversation uniqueness constraint; workspace
-- uniqueness above is the canonical tenant boundary after this cutover.
do $$ declare old_constraint name; begin
  for old_constraint in
    select c.conname from pg_constraint c
    where c.conrelid='public.conversations'::regclass and c.contype='u'
      and (select array_agg(a.attname order by key.ord)
           from unnest(c.conkey) with ordinality key(attnum,ord)
           join pg_attribute a on a.attrelid=c.conrelid and a.attnum=key.attnum)
          =array['user_id','customer_wa_id']::name[]
  loop execute format('alter table public.conversations drop constraint %I',old_constraint); end loop;
end $$;

do $$ declare old_index name; begin
  for old_index in
    select index_class.relname
    from pg_index i
    join pg_class index_class on index_class.oid=i.indexrelid
    left join pg_constraint c on c.conindid=i.indexrelid
    where i.indrelid='public.conversations'::regclass and i.indisunique and i.indisvalid
      and i.indnkeyatts=2 and i.indnatts=2 and i.indpred is null and c.oid is null
      and (select array_agg(a.attname order by key.ord)
           from unnest(i.indkey) with ordinality key(attnum,ord)
           join pg_attribute a on a.attrelid=i.indrelid and a.attnum=key.attnum)
          =array['user_id','customer_wa_id']::name[]
  loop execute format('drop index public.%I',old_index); end loop;
end $$;

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

-- The final committed policy set must be exactly the reviewed 14 workspace
-- policies. Names, commands, roles, and permissive mode are verified; policy
-- expressions are the statements constructed immediately above.
do $$
declare missing_or_wrong bigint; total_policies bigint;
begin
  with expected(table_name,policy_name,command_name) as (values
    ('ai_employees','Workspace members read AI employees','SELECT'),
    ('ai_employees','Workspace operators create AI employees','INSERT'),
    ('ai_employees','Workspace operators update AI employees','UPDATE'),
    ('ai_employees','Workspace admins delete AI employees','DELETE'),
    ('calls','Workspace members read calls','SELECT'),
    ('calls','Workspace operators insert calls','INSERT'),
    ('appointments','Workspace members read appointments','SELECT'),
    ('appointments','Workspace operators insert appointments','INSERT'),
    ('appointments','Workspace operators update appointments','UPDATE'),
    ('activity_events','Workspace members read activity','SELECT'),
    ('activity_events','Workspace operators insert activity','INSERT'),
    ('whatsapp_channels','Workspace admins manage WhatsApp channels','ALL'),
    ('conversations','Workspace members read conversations','SELECT'),
    ('messages','Workspace members read messages','SELECT')
  )
  select count(*) into missing_or_wrong from expected e
  left join pg_policies p on p.schemaname='public' and p.tablename=e.table_name
    and p.policyname=e.policy_name and p.cmd=e.command_name
    and p.permissive='PERMISSIVE' and p.roles=array['authenticated']::name[]
  where p.policyname is null;

  select count(*) into total_policies from pg_policies
  where schemaname='public'
    and tablename in ('ai_employees','calls','appointments','activity_events','whatsapp_channels','conversations','messages');
  if missing_or_wrong<>0 or total_policies<>14 then
    raise exception 'Workspace cutover produced an unexpected RLS policy set (% wrong/missing, % total)',missing_or_wrong,total_policies;
  end if;
end $$;

commit;
