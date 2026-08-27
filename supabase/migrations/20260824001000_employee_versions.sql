-- Bounded, owner-visible AI Employee settings history and guarded restore.
-- Apply after team role management. Keep EMPLOYEE_VERSION_HISTORY_ENABLED=false
-- until this migration and the two-account RLS checks pass in a test project.
begin;

create table if not exists public.ai_employee_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ai_employee_id uuid not null references public.ai_employees(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  change_source text not null default 'settings_update'
    check (change_source in ('migration_baseline', 'settings_update', 'restore')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.ai_employee_versions enable row level security;

drop policy if exists "Workspace members read employee versions" on public.ai_employee_versions;
create policy "Workspace members read employee versions" on public.ai_employee_versions
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- History is immutable to browser clients. Trusted triggers and the guarded
-- restore RPC are the only writers; there are intentionally no client write policies.
create index if not exists ai_employee_versions_employee_created_idx
  on public.ai_employee_versions(ai_employee_id, created_at desc);
create index if not exists ai_employee_versions_workspace_created_idx
  on public.ai_employee_versions(workspace_id, created_at desc);

create or replace function public.ai_employee_settings_snapshot(employee public.ai_employees)
returns jsonb language sql stable set search_path = public
as $$
  select jsonb_build_object(
    'name', employee.name,
    'business_name', employee.business_name,
    'phone', employee.phone,
    'voice', employee.voice,
    'language', employee.language,
    'department', employee.department,
    'business_description', employee.business_description,
    'greeting_message', employee.greeting_message,
    'timezone', employee.timezone,
    'working_hours', employee.working_hours,
    'accent', employee.accent,
    'speaking_style', employee.speaking_style,
    'speaking_speed', employee.speaking_speed,
    'tone', employee.tone,
    'country', employee.country,
    'business_hours', employee.business_hours,
    'call_forwarding_number', employee.call_forwarding_number,
    'call_routing_rule', employee.call_routing_rule,
    'knowledge_website', employee.knowledge_website,
    'knowledge_faq_document', employee.knowledge_faq_document,
    'knowledge_pdf_url', employee.knowledge_pdf_url,
    'knowledge_notes', employee.knowledge_notes
  )
$$;
revoke all on function public.ai_employee_settings_snapshot(public.ai_employees) from public;

create or replace function public.record_ai_employee_settings_version()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  previous_snapshot jsonb;
  source_label text;
begin
  if row(
    old.name, old.business_name, old.phone, old.voice, old.language,
    old.department, old.business_description, old.greeting_message,
    old.timezone, old.working_hours, old.accent, old.speaking_style,
    old.speaking_speed, old.tone, old.country, old.business_hours,
    old.call_forwarding_number, old.call_routing_rule,
    old.knowledge_website, old.knowledge_faq_document,
    old.knowledge_pdf_url, old.knowledge_notes
  ) is not distinct from row(
    new.name, new.business_name, new.phone, new.voice, new.language,
    new.department, new.business_description, new.greeting_message,
    new.timezone, new.working_hours, new.accent, new.speaking_style,
    new.speaking_speed, new.tone, new.country, new.business_hours,
    new.call_forwarding_number, new.call_routing_rule,
    new.knowledge_website, new.knowledge_faq_document,
    new.knowledge_pdf_url, new.knowledge_notes
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(old.id::text, 0));
  previous_snapshot := public.ai_employee_settings_snapshot(old);
  source_label := coalesce(current_setting('nexa.version_change_source', true), 'settings_update');
  if source_label not in ('settings_update', 'restore') then
    source_label := 'settings_update';
  end if;

  if not exists (
    select 1
    from public.ai_employee_versions
    where ai_employee_id = old.id and snapshot = previous_snapshot
    order by created_at desc
    limit 1
  ) then
    insert into public.ai_employee_versions (
      workspace_id, ai_employee_id, created_by, change_source, snapshot
    ) values (
      old.workspace_id, old.id, auth.uid(), source_label, previous_snapshot
    );
  end if;

  -- Retain the newest 50 immutable snapshots per employee.
  delete from public.ai_employee_versions
  where id in (
    select id from public.ai_employee_versions
    where ai_employee_id = old.id
    order by created_at desc, id desc
    offset 50
  );

  return new;
end $$;
revoke all on function public.record_ai_employee_settings_version() from public;

drop trigger if exists record_ai_employee_settings_version on public.ai_employees;
create trigger record_ai_employee_settings_version
before update of
  name, business_name, phone, voice, language, department,
  business_description, greeting_message, timezone, working_hours,
  accent, speaking_style, speaking_speed, tone, country, business_hours,
  call_forwarding_number, call_routing_rule, knowledge_website,
  knowledge_faq_document, knowledge_pdf_url, knowledge_notes
on public.ai_employees
for each row execute function public.record_ai_employee_settings_version();

-- Give every existing employee one honest baseline without inventing history.
insert into public.ai_employee_versions (
  workspace_id, ai_employee_id, created_by, change_source, snapshot
)
select
  employee.workspace_id,
  employee.id,
  null,
  'migration_baseline',
  public.ai_employee_settings_snapshot(employee)
from public.ai_employees employee
where not exists (
  select 1 from public.ai_employee_versions version
  where version.ai_employee_id = employee.id
);

create or replace function public.restore_ai_employee_version(
  target_employee_id uuid,
  target_version_id uuid
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  employee public.ai_employees%rowtype;
  version public.ai_employee_versions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into employee from public.ai_employees where id = target_employee_id;
  if not found or not public.workspace_has_role(
    employee.workspace_id,
    array['owner', 'admin', 'operator']
  ) then
    raise exception 'Version cannot be restored';
  end if;

  select * into version
  from public.ai_employee_versions
  where id = target_version_id
    and ai_employee_id = employee.id
    and workspace_id = employee.workspace_id;
  if not found then
    raise exception 'Version cannot be restored';
  end if;

  perform set_config('nexa.version_change_source', 'restore', true);

  update public.ai_employees set
    name = version.snapshot->>'name',
    business_name = version.snapshot->>'business_name',
    phone = version.snapshot->>'phone',
    voice = version.snapshot->>'voice',
    language = version.snapshot->>'language',
    department = version.snapshot->>'department',
    business_description = version.snapshot->>'business_description',
    greeting_message = version.snapshot->>'greeting_message',
    timezone = version.snapshot->>'timezone',
    working_hours = version.snapshot->>'working_hours',
    accent = version.snapshot->>'accent',
    speaking_style = version.snapshot->>'speaking_style',
    speaking_speed = version.snapshot->>'speaking_speed',
    tone = version.snapshot->>'tone',
    country = version.snapshot->>'country',
    business_hours = version.snapshot->>'business_hours',
    call_forwarding_number = version.snapshot->>'call_forwarding_number',
    call_routing_rule = version.snapshot->>'call_routing_rule',
    knowledge_website = version.snapshot->>'knowledge_website',
    knowledge_faq_document = version.snapshot->>'knowledge_faq_document',
    knowledge_pdf_url = version.snapshot->>'knowledge_pdf_url',
    knowledge_notes = version.snapshot->>'knowledge_notes'
  where id = employee.id;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    employee.workspace_id,
    auth.uid(),
    'ai_employee',
    employee.id,
    'employee_version_restored',
    jsonb_build_object('version_id', version.id)
  );

  return true;
end $$;
revoke all on function public.restore_ai_employee_version(uuid, uuid) from public;
grant execute on function public.restore_ai_employee_version(uuid, uuid) to authenticated;

commit;
