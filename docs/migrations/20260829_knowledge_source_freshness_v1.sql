-- Knowledge Source Registry v1.1: metadata-only manual freshness and deletion proof.
-- A manual review records only when a person reviewed the reference metadata.
-- It does not claim that Nexa fetched, opened, parsed, or verified source content.
begin;

alter table public.knowledge_sources
  add column reviewed_at timestamptz,
  add column review_due_at timestamptz,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add constraint knowledge_sources_review_shape_check check (
    (reviewed_at is null and review_due_at is null and reviewed_by is null)
    or (reviewed_at is not null and review_due_at > reviewed_at and reviewed_by is not null)
  );

create table public.knowledge_source_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  ai_employee_id uuid not null,
  knowledge_source_id uuid not null unique,
  source_kind text not null check (source_kind in ('website', 'file')),
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now()
);
alter table public.knowledge_source_deletion_receipts enable row level security;
revoke all on table public.knowledge_source_deletion_receipts from public, anon, authenticated;
grant select on table public.knowledge_source_deletion_receipts to authenticated;
create policy "Workspace members read source deletion receipts"
  on public.knowledge_source_deletion_receipts for select to authenticated
  using (public.is_workspace_member(workspace_id));
create index knowledge_source_deletion_receipts_workspace_employee_deleted_idx
  on public.knowledge_source_deletion_receipts(workspace_id, ai_employee_id, deleted_at desc);

revoke delete on table public.knowledge_sources from authenticated;

create function public.mark_knowledge_source_reviewed(
  target_employee_id uuid, target_source_id uuid, review_due_days integer
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  source public.knowledge_sources%rowtype;
  reviewed_time timestamptz := statement_timestamp();
begin
  if auth.uid() is null or review_due_days not between 1 and 365 then
    raise exception 'Knowledge source review cannot be recorded';
  end if;
  select * into source from public.knowledge_sources
    where id = target_source_id and ai_employee_id = target_employee_id for update;
  if not found or not public.workspace_has_role(
    source.workspace_id, array['owner', 'admin', 'operator']
  ) then raise exception 'Knowledge source review cannot be recorded'; end if;
  update public.knowledge_sources set
    reviewed_at = reviewed_time,
    review_due_at = reviewed_time + make_interval(days => review_due_days),
    reviewed_by = auth.uid()
  where id = source.id returning * into source;
  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    source.workspace_id, auth.uid(), 'ai_employee', source.ai_employee_id,
    'knowledge_source_review_recorded',
    jsonb_build_object(
      'knowledge_source_id', source.id,
      'source_kind', source.kind,
      'review_due_days', review_due_days
    )
  );
  return to_jsonb(source);
end $$;
revoke all on function public.mark_knowledge_source_reviewed(uuid, uuid, integer)
  from public, anon;
grant execute on function public.mark_knowledge_source_reviewed(uuid, uuid, integer)
  to authenticated;

create function public.record_knowledge_source_deletion_receipt()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.knowledge_source_deletion_receipts (
    workspace_id, ai_employee_id, knowledge_source_id, source_kind, deleted_by
  ) values (old.workspace_id, old.ai_employee_id, old.id, old.kind, auth.uid());
  return old;
end $$;
revoke all on function public.record_knowledge_source_deletion_receipt() from public;
create trigger record_knowledge_source_deletion_receipt
  before delete on public.knowledge_sources
  for each row execute function public.record_knowledge_source_deletion_receipt();

create function public.delete_knowledge_source(
  target_employee_id uuid, target_source_id uuid
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  source public.knowledge_sources%rowtype;
  receipt public.knowledge_source_deletion_receipts%rowtype;
begin
  if auth.uid() is null then raise exception 'Knowledge source cannot be deleted'; end if;
  select * into source from public.knowledge_sources
    where id = target_source_id and ai_employee_id = target_employee_id for update;
  if not found or not public.workspace_has_role(
    source.workspace_id, array['owner', 'admin', 'operator']
  ) then raise exception 'Knowledge source cannot be deleted'; end if;
  delete from public.knowledge_sources where id = source.id;
  select * into strict receipt from public.knowledge_source_deletion_receipts
    where knowledge_source_id = source.id;
  return to_jsonb(receipt);
end $$;
revoke all on function public.delete_knowledge_source(uuid, uuid) from public, anon;
grant execute on function public.delete_knowledge_source(uuid, uuid) to authenticated;

commit;
