-- WhatsApp outbound: 'sent' status for human-approved sends.
-- Persisting a real outbound send needs a status the original messages.status
-- check constraint (created before the outbound sender) did not allow. Only
-- the approve-and-send workflow ever sets this value; inbound message statuses
-- and delivery statuses are untouched, and the constraint is re-created with
-- the same shape plus the new value.
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