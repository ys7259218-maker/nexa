-- Privacy-Safe Issue Reporting v2: controlled self-service deletion.
-- V1 made every report immutable as defense in depth. V2 narrows that guard to
-- updates only (identity/content can never be reassigned) and opens deletion
-- exclusively through one guarded RPC. Browser roles receive no direct delete
-- grant, so every removal is scoped, checked, and audited by Postgres.
begin;

drop trigger prevent_issue_report_mutation on public.issue_reports;

create function public.prevent_issue_report_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Issue reports cannot be edited';
end $$;
revoke all on function public.prevent_issue_report_update() from public, anon, authenticated;
create trigger prevent_issue_report_update
  before update on public.issue_reports
  for each row execute function public.prevent_issue_report_update();

create function public.delete_issue_report(target_report_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  report public.issue_reports%rowtype;
begin
  if auth.uid() is null then raise exception 'Issue report cannot be deleted'; end if;
  select * into report from public.issue_reports where id = target_report_id for update;
  if not found then raise exception 'Issue report cannot be deleted'; end if;
  if report.reporter_user_id <> auth.uid() and not public.workspace_has_role(
    report.workspace_id, array['owner', 'admin']
  ) then
    raise exception 'Issue report cannot be deleted';
  end if;
  delete from public.issue_reports where id = report.id;
  insert into public.audit_events (
    workspace_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    report.workspace_id, auth.uid(), 'issue_report', report.id,
    'issue_report_deleted', jsonb_build_object('issue_report_id', report.id)
  );
  return to_jsonb(report);
end $$;
revoke all on function public.delete_issue_report(uuid) from public, anon;
grant execute on function public.delete_issue_report(uuid) to authenticated;

commit;

-- A reporter deletes only their own reports. Owner and Admin members may delete
-- any report in the workspace for triage. Operators, Viewers, and non-members
-- are rejected. The audit entry records only the report id; titles,
-- descriptions, categories, and diagnostics are never written to audit.