-- Metadata-only Knowledge Source Registry v1.
-- Apply after conversation safety controls. Keep
-- KNOWLEDGE_SOURCE_REGISTRY_ENABLED=false until this migration and the
-- dedicated two-account role/RLS checks pass.
begin;

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ai_employee_id uuid not null,
  kind text not null check (kind in ('website', 'file')),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  website_url text not null default '',
  file_name text not null default '',
  file_media_type text not null default '',
  file_size_bytes bigint,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint knowledge_sources_employee_workspace_fkey
    foreign key (workspace_id, ai_employee_id)
    references public.ai_employees(workspace_id, id) on delete cascade,
  constraint knowledge_sources_metadata_shape_check check (
    (
      kind = 'website'
      and char_length(website_url) between 1 and 2048
      and website_url ~ '^https://[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:[/?][^#[:space:]]*)?$'
      and website_url !~* '^https://[^/]*(localhost|\.local|\.internal)(?:[/?]|$)'
      and file_name = ''
      and file_media_type = ''
      and file_size_bytes is null
    )
    or
    (
      kind = 'file'
      and website_url = ''
      and char_length(file_name) between 1 and 255
      and file_name !~ '[/\\]'
      and file_name !~ '[[:cntrl:]]'
      and file_name not in ('.', '..')
      and (
        (file_media_type = 'application/pdf' and lower(right(file_name, 4)) = '.pdf')
        or (file_media_type = 'text/plain' and lower(right(file_name, 4)) = '.txt')
      )
      and file_size_bytes between 1 and 26214400
    )
  )
);

alter table public.knowledge_sources enable row level security;
revoke all on table public.knowledge_sources from public, anon;
grant select, delete on table public.knowledge_sources to authenticated;

create policy "Workspace members read knowledge sources" on public.knowledge_sources
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace operators delete knowledge sources" on public.knowledge_sources
  for delete to authenticated using (
    public.workspace_has_role(workspace_id, array['owner', 'admin', 'operator'])
  );

create index knowledge_sources_workspace_employee_created_idx
  on public.knowledge_sources(workspace_id, ai_employee_id, created_at desc);

-- Creation derives workspace and actor identity from authenticated database
-- state. Browser callers cannot insert arbitrary workspace or actor values.
create function public.create_knowledge_source(
  target_employee_id uuid,
  source_kind text,
  source_label text,
  source_website_url text,
  source_file_name text,
  source_file_media_type text,
  source_file_size_bytes bigint
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  employee public.ai_employees%rowtype;
  created public.knowledge_sources%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into employee
  from public.ai_employees
  where id = target_employee_id
  for share;

  if not found or not public.workspace_has_role(
    employee.workspace_id,
    array['owner', 'admin', 'operator']
  ) then
    raise exception 'Knowledge source cannot be created';
  end if;

  insert into public.knowledge_sources (
    workspace_id,
    ai_employee_id,
    kind,
    label,
    website_url,
    file_name,
    file_media_type,
    file_size_bytes,
    created_by
  ) values (
    employee.workspace_id,
    employee.id,
    source_kind,
    btrim(source_label),
    btrim(source_website_url),
    btrim(source_file_name),
    source_file_media_type,
    source_file_size_bytes,
    auth.uid()
  ) returning * into created;

  return to_jsonb(created);
end $$;
revoke all on function public.create_knowledge_source(uuid, text, text, text, text, text, bigint)
  from public, anon;
grant execute on function public.create_knowledge_source(uuid, text, text, text, text, text, bigint)
  to authenticated;

create function public.audit_knowledge_source_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  source public.knowledge_sources%rowtype;
begin
  if tg_op = 'DELETE' then
    source := old;
  else
    source := new;
  end if;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    source.workspace_id,
    auth.uid(),
    'ai_employee',
    source.ai_employee_id,
    case when tg_op = 'DELETE'
      then 'knowledge_source_deleted'
      else 'knowledge_source_created'
    end,
    jsonb_build_object(
      'knowledge_source_id', source.id,
      'source_kind', source.kind
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;
revoke all on function public.audit_knowledge_source_change() from public;

create trigger audit_knowledge_source_change
after insert or delete on public.knowledge_sources
for each row execute function public.audit_knowledge_source_change();

commit;
