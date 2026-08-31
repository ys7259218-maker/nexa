-- Nexa Phase 1: workspace tenancy foundation.
-- Apply before 20260824_workspace_tenancy_cutover.sql. Test in a dedicated
-- Supabase project, record a backup, and keep Phase 1 feature flags disabled.

begin;

do $$ begin
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then
    raise exception 'Supabase Auth prerequisites are missing';
  end if;
end $$;

select pg_advisory_xact_lock(hashtextextended('nexa.workspace_foundation', 0));

-- Block Auth inserts only for this short transaction so no signup can land
-- between the account scan/invariant check and bootstrap-trigger installation.
-- Reads remain available; pending signups resume after commit.
lock table auth.users in share row exclusive mode;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  is_personal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility with the former embedded foundation.
alter table public.workspaces add column if not exists is_personal boolean not null default false;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- CREATE TABLE IF NOT EXISTS must never accept unrelated or weakened tables.
do $$
declare incompatible_columns text[]; unexpected_policies text;
begin
  with required(table_name, column_name, udt_name, is_nullable) as (
    values
      ('workspaces','id','uuid','NO'), ('workspaces','name','text','NO'),
      ('workspaces','created_by','uuid','NO'), ('workspaces','is_personal','bool','NO'),
      ('workspaces','created_at','timestamptz','NO'), ('workspaces','updated_at','timestamptz','NO'),
      ('workspace_members','workspace_id','uuid','NO'), ('workspace_members','user_id','uuid','NO'),
      ('workspace_members','role','text','NO'), ('workspace_members','created_at','timestamptz','NO')
  )
  select array_agg(format('%I.%I', required.table_name, required.column_name))
  into incompatible_columns
  from required left join information_schema.columns existing
    on existing.table_schema='public' and existing.table_name=required.table_name
   and existing.column_name=required.column_name and existing.udt_name=required.udt_name
   and existing.is_nullable=required.is_nullable
  where existing.column_name is null;
  if incompatible_columns is not null then
    raise exception 'Workspace foundation columns are incompatible at: %', array_to_string(incompatible_columns, ', ');
  end if;

  if not exists (
    select 1 from pg_constraint c where c.conrelid='public.workspaces'::regclass and c.contype='p'
    and (select array_agg(a.attname order by key.ord) from unnest(c.conkey) with ordinality key(attnum,ord)
         join pg_attribute a on a.attrelid=c.conrelid and a.attnum=key.attnum)=array['id']::name[]
  ) then raise exception 'workspaces must have PRIMARY KEY (id)'; end if;

  if not exists (
    select 1 from pg_constraint c where c.conrelid='public.workspace_members'::regclass and c.contype='p'
    and (select array_agg(a.attname order by key.ord) from unnest(c.conkey) with ordinality key(attnum,ord)
         join pg_attribute a on a.attrelid=c.conrelid and a.attnum=key.attnum)=array['workspace_id','user_id']::name[]
  ) then raise exception 'workspace_members must have PRIMARY KEY (workspace_id, user_id)'; end if;

  if not exists (
    select 1 from pg_constraint c where c.conrelid='public.workspaces'::regclass and c.contype='f'
    and c.confrelid='auth.users'::regclass and c.confdeltype='r'
    and cardinality(c.conkey)=1 and cardinality(c.confkey)=1
    and (select a.attname from pg_attribute a where a.attrelid=c.conrelid and a.attnum=c.conkey[1])='created_by'
    and (select a.attname from pg_attribute a where a.attrelid=c.confrelid and a.attnum=c.confkey[1])='id'
  ) then raise exception 'workspaces.created_by must reference auth.users(id) ON DELETE RESTRICT'; end if;

  if not exists (
    select 1 from pg_constraint c where c.conrelid='public.workspace_members'::regclass and c.contype='f'
    and c.confrelid='public.workspaces'::regclass and c.confdeltype='c'
    and cardinality(c.conkey)=1 and cardinality(c.confkey)=1
    and (select a.attname from pg_attribute a where a.attrelid=c.conrelid and a.attnum=c.conkey[1])='workspace_id'
    and (select a.attname from pg_attribute a where a.attrelid=c.confrelid and a.attnum=c.confkey[1])='id'
  ) then raise exception 'workspace_members.workspace_id must reference workspaces(id) ON DELETE CASCADE'; end if;

  if not exists (
    select 1 from pg_constraint c where c.conrelid='public.workspace_members'::regclass and c.contype='f'
    and c.confrelid='auth.users'::regclass and c.confdeltype='c'
    and cardinality(c.conkey)=1 and cardinality(c.confkey)=1
    and (select a.attname from pg_attribute a where a.attrelid=c.conrelid and a.attnum=c.conkey[1])='user_id'
    and (select a.attname from pg_attribute a where a.attrelid=c.confrelid and a.attnum=c.confkey[1])='id'
  ) then raise exception 'workspace_members.user_id must reference auth.users(id) ON DELETE CASCADE'; end if;

  select string_agg(format('%I.%I',tablename,policyname),', ' order by tablename,policyname)
  into unexpected_policies from pg_policies
  where schemaname='public' and tablename in ('workspaces','workspace_members')
    and not (
      (tablename='workspaces' and policyname='Members read their workspaces')
      or (tablename='workspace_members' and policyname='Members read workspace membership')
    );
  if unexpected_policies is not null then
    raise exception 'Unexpected workspace policies require explicit review: %', unexpected_policies;
  end if;
end $$;

-- Enforce canonical defaults and named CHECK constraints instead of trusting
-- catalog text that can be made to look similar while expressing weaker logic.
alter table public.workspaces
  alter column id set default gen_random_uuid(),
  alter column is_personal set default false,
  alter column created_at set default now(),
  alter column updated_at set default now(),
  drop constraint if exists workspaces_name_length_check_v2,
  add constraint workspaces_name_length_check_v2
    check (char_length(name) >= 1 and char_length(name) <= 120);

alter table public.workspace_members
  alter column created_at set default now(),
  drop constraint if exists workspace_members_role_check_v2,
  add constraint workspace_members_role_check_v2
    check (role = any (array['owner','admin','operator','viewer']::text[]));

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.workspaces'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.workspace_members'::regclass)
  then raise exception 'RLS must be enabled on both workspace tables'; end if;
end $$;

create index if not exists workspace_members_user_idx on public.workspace_members(user_id,created_at);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists (select 1 from public.workspace_members
    where workspace_id=target_workspace_id and user_id=(select auth.uid()))
$$;
revoke all on function public.is_workspace_member(uuid) from public,anon,authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;

drop policy if exists "Members read their workspaces" on public.workspaces;
create policy "Members read their workspaces" on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
drop policy if exists "Members read workspace membership" on public.workspace_members;
create policy "Members read workspace membership" on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

do $$ begin
  if (select count(*) from pg_policies
      where schemaname='public' and tablename in ('workspaces','workspace_members'))<>2
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='workspaces'
       and policyname='Members read their workspaces' and cmd='SELECT' and permissive='PERMISSIVE'
       and roles=array['authenticated']::name[])
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='workspace_members'
       and policyname='Members read workspace membership' and cmd='SELECT' and permissive='PERMISSIVE'
       and roles=array['authenticated']::name[])
  then raise exception 'Workspace RLS policy set is not the expected read-only pair'; end if;
end $$;

-- Never treat a shared membership as legacy-data ownership. Adopt a sole safe
-- creator-owned candidate, create one when absent, and abort on ambiguity.
do $$
declare account record; personal_count integer; candidate_count integer; personal_workspace_id uuid;
begin
  for account in select id,email from auth.users order by created_at,id loop
    perform pg_advisory_xact_lock(hashtextextended(account.id::text,0));
    select count(*) into personal_count from public.workspaces where created_by=account.id and is_personal;
    if personal_count>1 then
      raise exception 'Account % has multiple personal workspaces', account.id;
    elsif personal_count=0 then
      select count(*) into candidate_count
      from public.workspaces w join public.workspace_members owner_membership
        on owner_membership.workspace_id=w.id and owner_membership.user_id=account.id and owner_membership.role='owner'
      where w.created_by=account.id and not w.is_personal
        and not exists (select 1 from public.workspace_members other where other.workspace_id=w.id and other.user_id<>account.id);
      if candidate_count>1 then
        raise exception 'Account % has % ambiguous personal-workspace candidates',account.id,candidate_count;
      elsif candidate_count=1 then
        select w.id into personal_workspace_id
        from public.workspaces w join public.workspace_members owner_membership
          on owner_membership.workspace_id=w.id and owner_membership.user_id=account.id and owner_membership.role='owner'
        where w.created_by=account.id and not w.is_personal
          and not exists (select 1 from public.workspace_members other where other.workspace_id=w.id and other.user_id<>account.id)
        order by w.id::text limit 1;
        update public.workspaces set is_personal=true where id=personal_workspace_id;
      else
        insert into public.workspaces(name,created_by,is_personal)
        values(left(coalesce(nullif(split_part(account.email,'@',1),''),'My'),108)||'''s Workspace',account.id,true)
        returning id into personal_workspace_id;
        insert into public.workspace_members(workspace_id,user_id,role) values(personal_workspace_id,account.id,'owner');
      end if;
    end if;
  end loop;
end $$;

do $$ declare invalid_users bigint; begin
  select count(*) into invalid_users from auth.users account where (
    select count(*) from public.workspaces w
    where w.created_by=account.id and w.is_personal
      and exists(select 1 from public.workspace_members m where m.workspace_id=w.id and m.user_id=account.id and m.role='owner')
      and not exists(select 1 from public.workspace_members other where other.workspace_id=w.id and other.user_id<>account.id)
  )<>1;
  if invalid_users<>0 then raise exception 'Personal workspace invariant failed for % auth users',invalid_users; end if;
end $$;

do $$ begin
  if to_regclass('public.workspaces_one_personal_per_creator_uidx') is not null
     and not exists (
       select 1 from pg_index i
       where i.indexrelid=to_regclass('public.workspaces_one_personal_per_creator_uidx')
         and i.indrelid='public.workspaces'::regclass and i.indisunique and i.indisvalid
         and (select array_agg(a.attname order by key.ord)
              from unnest(i.indkey) with ordinality key(attnum,ord)
              join pg_attribute a on a.attrelid=i.indrelid and a.attnum=key.attnum)
             =array['created_by']::name[]
         and pg_get_expr(i.indpred,i.indrelid)='is_personal'
     )
  then raise exception 'Existing personal-workspace unique index is incompatible'; end if;
end $$;

create unique index if not exists workspaces_one_personal_per_creator_uidx
  on public.workspaces(created_by) where is_personal;

create or replace function public.protect_personal_workspace_identity()
returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin
  if old.created_by is distinct from new.created_by or old.is_personal is distinct from new.is_personal
  then raise exception 'Workspace ownership identity is immutable'; end if;
  return new;
end $$;

create or replace function public.protect_personal_workspace_membership()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare target_creator uuid;
begin
  if tg_op in ('DELETE','UPDATE')
     and exists(select 1 from public.workspaces where id=old.workspace_id and is_personal)
     and (tg_op='DELETE' or new.workspace_id is distinct from old.workspace_id
          or new.user_id is distinct from old.user_id or new.role is distinct from 'owner')
  then raise exception 'A personal workspace must retain its creator-owner membership'; end if;
  if tg_op in ('INSERT','UPDATE') then
    select created_by into target_creator from public.workspaces where id=new.workspace_id and is_personal;
    if target_creator is not null and (new.user_id is distinct from target_creator or new.role is distinct from 'owner')
    then raise exception 'A personal workspace cannot contain other members'; end if;
    return new;
  end if;
  return old;
end $$;

revoke all on function public.protect_personal_workspace_identity() from public,anon,authenticated;
revoke all on function public.protect_personal_workspace_membership() from public,anon,authenticated;
drop trigger if exists protect_personal_workspace_identity on public.workspaces;
create trigger protect_personal_workspace_identity before update of created_by,is_personal on public.workspaces
  for each row execute function public.protect_personal_workspace_identity();
drop trigger if exists protect_personal_workspace_membership on public.workspace_members;
create trigger protect_personal_workspace_membership before insert or update or delete on public.workspace_members
  for each row execute function public.protect_personal_workspace_membership();

create or replace function public.bootstrap_user_workspace()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare new_workspace_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text,0));
  if exists(select 1 from public.workspaces w join public.workspace_members m on m.workspace_id=w.id
    where w.created_by=new.id and w.is_personal and m.user_id=new.id and m.role='owner') then return new; end if;
  insert into public.workspaces(name,created_by,is_personal)
  values(left(coalesce(nullif(split_part(new.email,'@',1),''),'My'),108)||'''s Workspace',new.id,true)
  returning id into new_workspace_id;
  insert into public.workspace_members(workspace_id,user_id,role) values(new_workspace_id,new.id,'owner');
  return new;
end $$;
revoke all on function public.bootstrap_user_workspace() from public,anon,authenticated;
drop trigger if exists create_workspace_after_signup on auth.users;
create trigger create_workspace_after_signup after insert on auth.users
  for each row execute function public.bootstrap_user_workspace();

commit;

-- Rollback: failures roll back automatically. Before cutover retain data and
-- remove only these triggers/functions/policies. After cutover use the recorded
-- backup and later migration rollback notes.
