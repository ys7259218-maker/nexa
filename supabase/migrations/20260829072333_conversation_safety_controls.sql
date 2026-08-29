-- Conversation-level human takeover and durable customer opt-out controls.
-- This migration is additive and does not enable outbound WhatsApp sending.
begin;

alter table public.conversations
  add column if not exists automation_mode text not null default 'ai',
  add column if not exists human_takeover_at timestamptz,
  add column if not exists customer_opted_out_at timestamptz,
  add column if not exists customer_opt_out_source text,
  add column if not exists safety_updated_at timestamptz not null default now(),
  add column if not exists safety_updated_by uuid;

do $$
declare
  incompatible_columns text[];
  safety_actor_attnum smallint;
  incompatible_actor_fks bigint;
begin
  with required(column_name, udt_name, is_nullable) as (
    values
      ('automation_mode', 'text', 'NO'),
      ('human_takeover_at', 'timestamptz', 'YES'),
      ('customer_opted_out_at', 'timestamptz', 'YES'),
      ('customer_opt_out_source', 'text', 'YES'),
      ('safety_updated_at', 'timestamptz', 'NO'),
      ('safety_updated_by', 'uuid', 'YES')
  )
  select pg_catalog.array_agg(required.column_name order by required.column_name)
  into incompatible_columns
  from required
  left join information_schema.columns existing
    on existing.table_schema = 'public'
   and existing.table_name = 'conversations'
   and existing.column_name = required.column_name
   and existing.udt_name = required.udt_name
   and existing.is_nullable = required.is_nullable
  where existing.column_name is null;
  if incompatible_columns is not null then
    raise exception 'Conversation safety columns are incompatible: %',
      pg_catalog.array_to_string(incompatible_columns, ', ');
  end if;

  select attnum into safety_actor_attnum
  from pg_catalog.pg_attribute
  where attrelid = 'public.conversations'::regclass
    and attname = 'safety_updated_by'
    and not attisdropped;

  select pg_catalog.count(*) into incompatible_actor_fks
  from pg_catalog.pg_constraint constraint_row
  where constraint_row.conrelid = 'public.conversations'::regclass
    and constraint_row.contype = 'f'
    and safety_actor_attnum = any(constraint_row.conkey)
    and not (
      constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.confdeltype = 'n'
      and constraint_row.convalidated
      and not constraint_row.condeferrable
      and pg_catalog.cardinality(constraint_row.conkey) = 1
      and pg_catalog.cardinality(constraint_row.confkey) = 1
      and (
        select attribute_row.attname
        from pg_catalog.pg_attribute attribute_row
        where attribute_row.attrelid = constraint_row.confrelid
          and attribute_row.attnum = constraint_row.confkey[1]
      ) = 'id'
    );
  if incompatible_actor_fks <> 0 then
    raise exception 'conversations.safety_updated_by has an incompatible foreign key';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.conversations'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.confdeltype = 'n'
      and constraint_row.convalidated
      and not constraint_row.condeferrable
      and constraint_row.conkey = array[safety_actor_attnum]::smallint[]
  ) then
    alter table public.conversations
      add constraint conversations_safety_updated_by_fkey
      foreign key (safety_updated_by) references auth.users(id) on delete set null;
  end if;
end $$;

alter table public.conversations
  alter column automation_mode set default 'ai',
  alter column human_takeover_at drop default,
  alter column customer_opted_out_at drop default,
  alter column customer_opt_out_source drop default,
  alter column safety_updated_at set default now(),
  alter column safety_updated_by drop default;

alter table public.conversations
  drop constraint if exists conversations_automation_mode_check_v1,
  add constraint conversations_automation_mode_check_v1
    check (automation_mode = any (array['ai', 'human']::text[])),
  drop constraint if exists conversations_opt_out_source_check_v1,
  add constraint conversations_opt_out_source_check_v1
    check (
      (customer_opted_out_at is null and customer_opt_out_source is null)
      or
      (customer_opted_out_at is not null and customer_opt_out_source = 'whatsapp_keyword')
    );

create or replace function public.guard_conversation_safety_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    old.automation_mode is distinct from new.automation_mode
    or old.human_takeover_at is distinct from new.human_takeover_at
    or old.customer_opted_out_at is distinct from new.customer_opted_out_at
    or old.customer_opt_out_source is distinct from new.customer_opt_out_source
    or old.safety_updated_at is distinct from new.safety_updated_at
    or old.safety_updated_by is distinct from new.safety_updated_by
  ) and coalesce(current_setting('nexa.conversation_safety_write', true), '') <> 'allowed' then
    raise exception 'Conversation safety must be changed through an approved RPC';
  end if;
  return new;
end $$;
revoke all on function public.guard_conversation_safety_write() from public, anon, authenticated;

drop trigger if exists guard_conversation_safety_write on public.conversations;
create trigger guard_conversation_safety_write
before update of automation_mode, human_takeover_at, customer_opted_out_at,
  customer_opt_out_source, safety_updated_at, safety_updated_by
on public.conversations
for each row execute function public.guard_conversation_safety_write();

create or replace function public.set_conversation_human_takeover(
  target_workspace_id uuid,
  target_conversation_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_mode text;
  opted_out_at timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not public.workspace_has_role(
    target_workspace_id,
    array['owner', 'admin', 'operator']::text[]
  ) then
    raise exception 'Insufficient workspace role';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_conversation_id::text, 0)
  );
  select automation_mode, customer_opted_out_at
    into current_mode, opted_out_at
  from public.conversations
  where id = target_conversation_id and workspace_id = target_workspace_id
  for update;
  if not found then raise exception 'Conversation not found'; end if;

  if not enabled and opted_out_at is not null then
    raise exception 'Customer opt-out cannot be resumed through human takeover controls';
  end if;
  if current_mode = case when enabled then 'human' else 'ai' end then return; end if;

  perform pg_catalog.set_config('nexa.conversation_safety_write', 'allowed', true);
  update public.conversations
  set automation_mode = case when enabled then 'human' else 'ai' end,
      human_takeover_at = case when enabled then pg_catalog.now() else null end,
      safety_updated_at = pg_catalog.now(),
      safety_updated_by = (select auth.uid())
  where id = target_conversation_id and workspace_id = target_workspace_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    target_workspace_id,
    (select auth.uid()),
    'integration',
    target_conversation_id,
    case when enabled then 'conversation_human_takeover_started'
         else 'conversation_human_takeover_ended' end,
    pg_catalog.jsonb_build_object(
      'automation_mode',
      case when enabled then 'human' else 'ai' end
    )
  );
end $$;
revoke all on function public.set_conversation_human_takeover(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_conversation_human_takeover(uuid, uuid, boolean)
  to authenticated;

create or replace function public.mark_conversation_customer_opt_out(
  target_workspace_id uuid,
  target_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_opt_out timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_conversation_id::text, 0)
  );
  select customer_opted_out_at into existing_opt_out
  from public.conversations
  where id = target_conversation_id and workspace_id = target_workspace_id
  for update;
  if not found then raise exception 'Conversation not found'; end if;
  if existing_opt_out is not null then return; end if;

  perform pg_catalog.set_config('nexa.conversation_safety_write', 'allowed', true);
  update public.conversations
  set customer_opted_out_at = pg_catalog.now(),
      customer_opt_out_source = 'whatsapp_keyword',
      safety_updated_at = pg_catalog.now(),
      safety_updated_by = null
  where id = target_conversation_id and workspace_id = target_workspace_id;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    target_workspace_id,
    null,
    'integration',
    target_conversation_id,
    'conversation_customer_opted_out',
    pg_catalog.jsonb_build_object(
      'customer_opted_out', true,
      'source', 'whatsapp_keyword'
    )
  );
end $$;
revoke all on function public.mark_conversation_customer_opt_out(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.mark_conversation_customer_opt_out(uuid, uuid)
  to service_role;

commit;

-- Rollback guidance: first disable CONVERSATION_SAFETY_ENABLED. Preserve the
-- columns and audit rows. Revoke/drop both RPCs and the guard trigger only if a
-- reviewed replacement provides equivalent authorization and opt-out safety.
