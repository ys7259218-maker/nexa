-- WhatsApp outbound: 'sent' status for human-approved sends.
-- Mirrors supabase/migrations/20260905120000_outbound_sent_status.sql.
--
-- Context: outbound drafts are persisted as messages with status
-- 'draft_blocked' until a human approves them. Once approved and actually
-- accepted by WhatsApp, the row is updated to 'sent' (plus sent_at and the
-- provider wamid). The 2026-08-24 whatsapp_messaging migration defined the
-- status check constraint without 'sent' because the outbound sender was not
-- yet wired into a runtime path. This migration re-issues the constraint with
-- the additional value. Nothing else changes: inbound statuses still follow
-- their existing state machine, and 'sent' is only ever written by the
-- approve-and-send workflow.
begin;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'messages_status_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages drop constraint messages_status_check;
  end if;
end $$;

alter table public.messages
  add constraint messages_status_check
  check (status in ('received', 'delivered', 'read', 'failed', 'draft_blocked', 'sent'));

commit;