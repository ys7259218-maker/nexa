-- WhatsApp outbound: template_name for template-based sends.
-- Outside the 24-hour customer-service window Meta only accepts pre-approved
-- templates. A human-approved template send records the template reference so
-- the message row shows how it was transported. Free-form 'sent' rows leave
-- the column NULL; inbound and delivery-status behavior is unchanged.
begin;

alter table public.messages
  add column if not exists template_name text;

commit;