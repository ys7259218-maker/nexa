-- Privacy-Safe Issue Reporting v1. Rollout-gated; do not apply to production here.
create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('bug', 'accessibility', 'privacy', 'safety', 'other')),
  title text not null check (char_length(title) between 3 and 120 and title = btrim(title)),
  description text not null check (char_length(description) between 10 and 2000 and description = btrim(description)),
  status text not null default 'submitted' check (status = 'submitted'),
  created_at timestamptz not null default now()
);

create index if not exists issue_reports_workspace_created_idx
  on public.issue_reports (workspace_id, created_at desc);
create index if not exists issue_reports_reporter_created_idx
  on public.issue_reports (reporter_id, created_at desc);

alter table public.issue_reports enable row level security;
revoke all on table public.issue_reports from public, anon, authenticated;
grant select on table public.issue_reports to authenticated;

drop policy if exists issue_reports_select on public.issue_reports;
create policy issue_reports_select on public.issue_reports
  for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or public.workspace_has_role(workspace_id, array['owner', 'admin'])
  );

create or replace function public.create_issue_report(
  target_workspace_id uuid,
  report_category text,
  report_title text,
  report_description text
) returns public.issue_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_title text := btrim(report_title);
  normalized_description text := btrim(report_description);
  created_report public.issue_reports;
begin
  if actor_id is null or not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized';
  end if;
  if report_category not in ('bug', 'accessibility', 'privacy', 'safety', 'other') then
    raise exception 'Invalid issue category';
  end if;
  if char_length(normalized_title) not between 3 and 120
     or char_length(normalized_description) not between 10 and 2000 then
    raise exception 'Invalid issue report';
  end if;

  insert into public.issue_reports (workspace_id, reporter_id, category, title, description)
  values (target_workspace_id, actor_id, report_category, normalized_title, normalized_description)
  returning * into created_report;

  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  )
  values (
    target_workspace_id,
    actor_id,
    'issue_report',
    created_report.id,
    'issue_report_created',
    jsonb_build_object('category', report_category, 'status', 'submitted')
  );
  return created_report;
end;
$$;

revoke all on function public.create_issue_report(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_issue_report(uuid, text, text, text) to authenticated;

comment on table public.issue_reports is
  'Workspace-scoped user-submitted issue text. No automatic logs, headers, cookies, URLs, environment values, stack traces, messages, phone numbers, tokens, or telemetry are collected.';
