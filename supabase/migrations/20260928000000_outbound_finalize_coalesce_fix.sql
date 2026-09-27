-- Repair the service-role-only outbound finalizer without rewriting deployed history.
-- COALESCE is PostgreSQL expression syntax, not a pg_catalog function; the old
-- qualified call is stored in PL/pgSQL but fails when the UPDATE executes.
-- Outbound remains disabled until separately approved; this migration does not
-- enable any sends or alter rows.
begin;

create or replace function public.finalize_outbound_message_send(
  p_message_id uuid,
  p_claim_token uuid,
  p_owner_user_id uuid,
  p_wa_message_id text,
  p_sent_at timestamptz,
  p_template_name text
)
returns table (finalized boolean, reason text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.messages m
  set status = 'sent',
      wa_message_id = p_wa_message_id,
      sent_at = p_sent_at,
      template_name = coalesce(p_template_name, m.template_name),
      send_claim_token = null,
      send_claim_issued_at = null
  where m.id = p_message_id
    and m.user_id = p_owner_user_id
    and m.send_claim_token = p_claim_token
    and m.status in ('draft_blocked', 'failed');

  if found then
    finalized := true;
    reason := 'finalized';
    return next;
    return;
  end if;

  finalized := false;
  reason := 'claim_mismatch';
  return next;
end $$;

revoke all on function public.finalize_outbound_message_send(uuid, uuid, uuid, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.finalize_outbound_message_send(uuid, uuid, uuid, text, timestamptz, text)
  to service_role;

commit;
