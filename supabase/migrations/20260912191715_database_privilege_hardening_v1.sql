-- Database privilege hardening v1
--
-- RLS remains the row boundary. This migration narrows the independent SQL
-- privilege boundary so browser roles cannot call trigger/internal functions or
-- use table operations that the application does not require.
--
-- This migration is intentionally code-only until a recoverable backup and a
-- dedicated hosted rollout are explicitly approved and verified.

begin;

-- Supabase may provision broad default grants for API roles. Remove them from
-- every Nexa application table before rebuilding the authenticated allowlist.
revoke all privileges on table
  public.activity_events,
  public.ai_employee_activation_evidence,
  public.ai_employee_versions,
  public.ai_employees,
  public.appointments,
  public.audit_events,
  public.calls,
  public.conversations,
  public.issue_reports,
  public.knowledge_entries,
  public.knowledge_source_deletion_receipts,
  public.knowledge_sources,
  public.messages,
  public.webhook_events,
  public.whatsapp_channels,
  public.workspace_members,
  public.workspaces
from public, anon, authenticated;

-- Read/write capabilities used by authenticated browser clients. RLS policies
-- and database guards continue to decide which rows each user can affect.
grant select, insert on table public.activity_events to authenticated;
grant select on table public.ai_employee_versions to authenticated;
grant select, insert, update, delete on table public.ai_employees to authenticated;
grant select on table public.appointments to authenticated;
grant select on table public.audit_events to authenticated;
grant select on table public.calls to authenticated;
grant select on table public.conversations to authenticated;
grant select on table public.issue_reports to authenticated;
grant select, update, delete on table public.knowledge_entries to authenticated;
grant select on table public.knowledge_source_deletion_receipts to authenticated;
grant select on table public.knowledge_sources to authenticated;
grant select on table public.messages to authenticated;
grant select, insert, update, delete on table public.whatsapp_channels to authenticated;
grant select, update on table public.workspace_members to authenticated;
grant select on table public.workspaces to authenticated;

-- Explicitly remove direct API execution from every Nexa function. Trigger,
-- audit, guard, bootstrap, snapshot, ingestion, and outbound-claim functions
-- remain non-callable by browser roles.
revoke execute on function public.ai_employee_settings_snapshot(public.ai_employees) from public, anon, authenticated;
revoke execute on function public.audit_ai_employee_safety_change() from public, anon, authenticated;
revoke execute on function public.audit_knowledge_entry_change() from public, anon, authenticated;
revoke execute on function public.audit_knowledge_source_change() from public, anon, authenticated;
revoke execute on function public.audit_outbound_message_sent() from public, anon, authenticated;
revoke execute on function public.audit_whatsapp_channel_assignment() from public, anon, authenticated;
revoke execute on function public.audit_workspace_safety_change() from public, anon, authenticated;
revoke execute on function public.bootstrap_user_workspace() from public, anon, authenticated;
revoke execute on function public.claim_outbound_message_send(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_issue_report(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_knowledge_entry(uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.create_knowledge_source(uuid, text, text, text, text, text, bigint) from public, anon, authenticated;
revoke execute on function public.current_workspace_id() from public, anon, authenticated;
revoke execute on function public.delete_issue_report(uuid) from public, anon, authenticated;
revoke execute on function public.delete_knowledge_source(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.finalize_outbound_message_send(uuid, uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.guard_ai_employee_lifecycle_write() from public, anon, authenticated;
revoke execute on function public.guard_conversation_safety_write() from public, anon, authenticated;
revoke execute on function public.guard_knowledge_entry_write() from public, anon, authenticated;
revoke execute on function public.guard_workspace_role_change() from public, anon, authenticated;
revoke execute on function public.guard_workspace_safety_write() from public, anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from public, anon, authenticated;
revoke execute on function public.mark_conversation_customer_opt_out(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mark_knowledge_source_reviewed(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.prevent_issue_report_mutation() from public, anon, authenticated;
revoke execute on function public.prevent_issue_report_update() from public, anon, authenticated;
revoke execute on function public.protect_personal_workspace_identity() from public, anon, authenticated;
revoke execute on function public.protect_personal_workspace_membership() from public, anon, authenticated;
revoke execute on function public.protect_tenant_row_identity() from public, anon, authenticated;
revoke execute on function public.record_ai_employee_settings_version() from public, anon, authenticated;
revoke execute on function public.record_knowledge_source_deletion_receipt() from public, anon, authenticated;
revoke execute on function public.release_outbound_message_send(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.restore_ai_employee_version(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.set_ai_employee_automation_paused(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.set_conversation_human_takeover(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.set_workspace_automation_paused(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.transition_ai_employee_lifecycle(uuid, text) from public, anon, authenticated;
revoke execute on function public.workspace_has_role(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.workspace_role(uuid) from public, anon, authenticated;

-- Authenticated RPC allowlist. Each function derives or verifies caller identity;
-- service-only ingestion and outbound functions are deliberately excluded.
grant execute on function public.current_workspace_id() to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_has_role(uuid, text[]) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.transition_ai_employee_lifecycle(uuid, text) to authenticated;
grant execute on function public.set_ai_employee_automation_paused(uuid, boolean) to authenticated;
grant execute on function public.set_workspace_automation_paused(uuid, boolean) to authenticated;
grant execute on function public.restore_ai_employee_version(uuid, uuid) to authenticated;
grant execute on function public.create_knowledge_entry(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.create_knowledge_source(uuid, text, text, text, text, text, bigint) to authenticated;
grant execute on function public.mark_knowledge_source_reviewed(uuid, uuid, integer) to authenticated;
grant execute on function public.delete_knowledge_source(uuid, uuid) to authenticated;
grant execute on function public.set_conversation_human_takeover(uuid, uuid, boolean) to authenticated;
grant execute on function public.create_issue_report(uuid, text, text, text) to authenticated;
grant execute on function public.delete_issue_report(uuid) to authenticated;

-- Prevent later migrations created by postgres from silently recreating the
-- same broad API-role grants. Intentional access must be granted explicitly.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;

-- Rollback: do not restore the former broad grants. Disable feature flags,
-- pause workspaces, and restore a verified pre-migration backup or apply a
-- separately reviewed explicit privilege matrix.
