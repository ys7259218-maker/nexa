-- Explicitly bind each WhatsApp channel to one AI Employee. Existing channels
-- remain unassigned and the runtime fails closed until an Owner/Admin assigns
-- them; this migration never guesses an employee for existing data.
begin;

alter table public.whatsapp_channels
  add column if not exists ai_employee_id uuid;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'whatsapp_channels'
      and column_name = 'ai_employee_id'
      and udt_name = 'uuid'
      and is_nullable = 'YES'
  ) then
    raise exception 'whatsapp_channels.ai_employee_id is incompatible';
  end if;

  if to_regclass('public.ai_employees_workspace_id_id_uidx') is null then
    raise exception 'Channel assignment requires the canonical employee workspace identity index';
  end if;

  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.whatsapp_channels'::regclass
      and c.conname = 'whatsapp_channels_employee_workspace_fkey'
      and not (
        c.contype = 'f'
        and c.confrelid = 'public.ai_employees'::regclass
        and c.confdeltype = 'n'
        and c.convalidated
        and not c.condeferrable
        and (select array_agg(a.attname order by key.ord)
             from unnest(c.conkey) with ordinality key(attnum, ord)
             join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
            = array['workspace_id', 'ai_employee_id']::name[]
        and (select array_agg(a.attname order by key.ord)
             from unnest(c.confkey) with ordinality key(attnum, ord)
             join pg_attribute a on a.attrelid = c.confrelid and a.attnum = key.attnum)
            = array['workspace_id', 'id']::name[]
        and (select array_agg(a.attname order by key.ord)
             from unnest(c.confdelsetcols) with ordinality key(attnum, ord)
             join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
            = array['ai_employee_id']::name[]
      )
  ) then
    raise exception 'Existing channel assignment foreign key is incompatible';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whatsapp_channels'::regclass
      and conname = 'whatsapp_channels_employee_workspace_fkey'
  ) then
    alter table public.whatsapp_channels
      add constraint whatsapp_channels_employee_workspace_fkey
      foreign key (workspace_id, ai_employee_id)
      references public.ai_employees(workspace_id, id)
      on delete set null (ai_employee_id);
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.conversations c
    join public.ai_employees e on e.id = c.ai_employee_id
    where c.ai_employee_id is not null
      and c.workspace_id <> e.workspace_id
  ) then
    raise exception 'Cross-workspace conversation assignment exists; manual reconciliation required';
  end if;

  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.conversations'::regclass
      and c.conname = 'conversations_employee_workspace_fkey'
      and not (
        c.contype = 'f'
        and c.confrelid = 'public.ai_employees'::regclass
        and c.confdeltype = 'n'
        and c.convalidated
        and not c.condeferrable
        and (select array_agg(a.attname order by key.ord)
             from unnest(c.conkey) with ordinality key(attnum, ord)
             join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
            = array['workspace_id', 'ai_employee_id']::name[]
        and (select array_agg(a.attname order by key.ord)
             from unnest(c.confkey) with ordinality key(attnum, ord)
             join pg_attribute a on a.attrelid = c.confrelid and a.attnum = key.attnum)
            = array['workspace_id', 'id']::name[]
        and (select array_agg(a.attname order by key.ord)
             from unnest(c.confdelsetcols) with ordinality key(attnum, ord)
             join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum)
            = array['ai_employee_id']::name[]
      )
  ) then
    raise exception 'Existing conversation assignment foreign key is incompatible';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_employee_workspace_fkey'
  ) then
    alter table public.conversations
      add constraint conversations_employee_workspace_fkey
      foreign key (workspace_id, ai_employee_id)
      references public.ai_employees(workspace_id, id)
      on delete set null (ai_employee_id);
  end if;
end $$;

create index if not exists whatsapp_channels_workspace_employee_idx
  on public.whatsapp_channels(workspace_id, ai_employee_id);
create index if not exists conversations_workspace_employee_idx
  on public.conversations(workspace_id, ai_employee_id);

create or replace function public.audit_whatsapp_channel_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_action text;
begin
  if tg_op = 'UPDATE' and old.ai_employee_id is not distinct from new.ai_employee_id then
    return new;
  end if;
  if tg_op = 'INSERT' and new.ai_employee_id is null then
    return new;
  end if;

  event_action := case
    when new.ai_employee_id is null then 'whatsapp_channel_unassigned'
    when tg_op = 'INSERT' or old.ai_employee_id is null then 'whatsapp_channel_assigned'
    else 'whatsapp_channel_reassigned'
  end;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    new.workspace_id,
    auth.uid(),
    'integration',
    new.id,
    event_action,
    jsonb_build_object('ai_employee_id', new.ai_employee_id)
  );

  return new;
end $$;
revoke all on function public.audit_whatsapp_channel_assignment() from public, anon, authenticated;

drop trigger if exists audit_whatsapp_channel_assignment on public.whatsapp_channels;
create trigger audit_whatsapp_channel_assignment
after insert or update of ai_employee_id on public.whatsapp_channels
for each row execute function public.audit_whatsapp_channel_assignment();

commit;
