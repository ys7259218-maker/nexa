-- Privacy-Safe Issue Reporting v1. Code-only and rollout-gated.
-- Keep ISSUE_REPORTING_ENABLED=false until dedicated synthetic role/RLS proof.
begin;

create table public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('bug', 'usability', 'privacy', 'security', 'other')),
  title text not null check (char_length(btrim(title)) between 5 and 120),
  description text not null check (char_length(btrim(description)) between 20 and 4000),
  created_at timestamptz not null default now()
);

alter table public.issue_reports enable row level security;
revoke all on table public.issue_reports from public, anon, authenticated;
grant select on table public.issue_reports to authenticated;

create policy "Reporters and workspace administrators read issue reports"
  on public.issue_reports for select to authenticated
  using (
    reporter_user_id = (select auth.uid())
    or public.workspace_has_role(workspace_id, array['owner', 'admin'])
  );

create index issue_reports_workspace_created_idx
  on public.issue_reports(workspace_id, created_at desc);
create index issue_reports_reporter_created_idx
  on public.issue_reports(reporter_user_id, created_at desc);

create function public.create_issue_report(
  target_workspace_id uuid,
  report_category text,
  report_title text,
  report_description text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  created public.issue_reports%rowtype;
begin
  if auth.uid() is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Issue report cannot be created';
  end if;

  insert into public.issue_reports (
    workspace_id, reporter_user_id, category, title, description
  ) values (
    target_workspace_id, auth.uid(), report_category,
    btrim(report_title), btrim(report_description)
  ) returning * into created;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    created.workspace_id, created.reporter_user_id, 'issue_report', created.id,
    'issue_report_created', jsonb_build_object('issue_report_id', created.id)
  );

  return to_jsonb(created);
end $$;
revoke all on function public.create_issue_report(uuid, text, text, text)
  from public, anon;
grant execute on function public.create_issue_report(uuid, text, text, text)
  to authenticated;

create function public.prevent_issue_report_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Issue reports are immutable';
end $$;
revoke all on function public.prevent_issue_report_mutation() from public, anon, authenticated;
create trigger prevent_issue_report_mutation
  before update or delete on public.issue_reports
  for each row execute function public.prevent_issue_report_mutation();

commit;

-- Rollback starts by setting ISSUE_REPORTING_ENABLED=false. Preserve report
-- rows while access and retention requirements are reviewed; do not drop the
-- table or function on a data-bearing target without an approved export or
-- deletion decision. No live migration or automatic retention job is included.
