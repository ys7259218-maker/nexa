-- WhatsApp outbound: capture why Meta rejected a send (delivery status 'failed').
-- Meta status webhooks attach an errors[] block to failed receipts; the ingest
-- parser stores a bounded, human-readable reason here so the failed-sends retry
-- queue can explain the failure. Additive and nullable; free-form 'sent' rows
-- and delivered/read status behavior are unchanged.
begin;

alter table public.messages
  add column if not exists failure_reason text;

alter table public.messages
  add constraint messages_failure_reason_length
    check (failure_reason is null or char_length(failure_reason) between 1 and 400);

commit;