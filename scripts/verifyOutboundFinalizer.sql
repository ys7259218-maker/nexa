-- Disposable local database only. Every synthetic row is rolled back.
-- This prepares and executes the UPDATE path that a no-match probe misses.
begin;

do $probe$
declare
  v_owner uuid := '00000000-0000-0000-0000-00000000f101';
  v_conversation uuid := '00000000-0000-0000-0000-00000000f102';
  v_message uuid := '00000000-0000-0000-0000-00000000f103';
  v_claim uuid := '00000000-0000-0000-0000-00000000f104';
  v_other_claim uuid := '00000000-0000-0000-0000-00000000f105';
  v_workspace uuid;
  v_finalized boolean;
  v_reason text;
begin
  if exists (select 1 from auth.users)
    or exists (select 1 from public.workspaces)
    or exists (select 1 from public.conversations)
    or exists (select 1 from public.messages) then
    raise exception 'finalizer probe requires an empty disposable database';
  end if;

  insert into auth.users (id, email)
  values (v_owner, 'finalizer-local-fixture@example.invalid');

  select id into strict v_workspace
  from public.workspaces
  where created_by = v_owner and is_personal;

  insert into public.conversations
    (id, user_id, workspace_id, customer_wa_id)
  values
    (v_conversation, v_owner, v_workspace, 'local-fixture-customer');

  insert into public.messages
    (id, conversation_id, user_id, workspace_id, direction, status,
     body, template_name, send_claim_token, send_claim_issued_at)
  values
    (v_message, v_conversation, v_owner, v_workspace, 'outbound',
     'draft_blocked', 'local fixture only', 'existing_template', v_claim, now());

  select finalized, reason into strict v_finalized, v_reason
  from public.finalize_outbound_message_send(
    v_message, v_other_claim, v_owner, 'local-wamid-wrong', now(), null);
  if v_finalized is distinct from false or v_reason is distinct from 'claim_mismatch'
    or not exists (
      select 1 from public.messages
      where id = v_message and status = 'draft_blocked'
        and send_claim_token = v_claim and wa_message_id is null
    ) then
    raise exception 'mismatched claim changed the synthetic draft';
  end if;

  select finalized, reason into strict v_finalized, v_reason
  from public.finalize_outbound_message_send(
    v_message, v_claim, v_owner, 'local-wamid-final', now(), null);
  if v_finalized is distinct from true or v_reason is distinct from 'finalized'
    or not exists (
      select 1 from public.messages
      where id = v_message and status = 'sent'
        and wa_message_id = 'local-wamid-final'
        and template_name = 'existing_template'
        and sent_at is not null
        and send_claim_token is null and send_claim_issued_at is null
    ) then
    raise exception 'matching claim was not finalized as expected';
  end if;

  select finalized, reason into strict v_finalized, v_reason
  from public.finalize_outbound_message_send(
    v_message, v_claim, v_owner, 'local-wamid-replay', now(), null);
  if v_finalized is distinct from false or v_reason is distinct from 'claim_mismatch'
    or not exists (
      select 1 from public.messages
      where id = v_message and status = 'sent'
        and wa_message_id = 'local-wamid-final'
    ) then
    raise exception 'duplicate finalization changed the synthetic sent row';
  end if;
end $probe$;

rollback;
