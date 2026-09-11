-- WhatsApp outbound: atomic pre-send claim for human-approved sends.
-- Two concurrent approvals of the same pending draft must never both reach the
-- Meta transport. Before any transport call the service-role processor claims
-- the exact message row; a second concurrent claimant observes the committed
-- claim token and returns honestly without sending. Final status persistence is
-- conditional on the SAME claim token, so a stale or duplicate caller can never
-- finalize another approval's send.
--
-- The claim uses a single atomic UPDATE whose WHERE embeds every eligibility
-- predicate (message id, owner, conversation ownership, workspace boundary,
-- outbound direction, eligible pending status, no existing claim, no customer
-- opt-out, no human takeover). PostgreSQL READ COMMITTED row-lock semantics
-- serialize concurrent claimants: the loser re-evaluates the committed token
-- and matches nothing, so exactly one claim wins without advisory locks and
-- without claiming any row outside the caller's tenant.
--
-- All three RPCs are SECURITY INVOKER with search_path pinned and explicit
-- owner/workspace predicates. They are executable only by service_role; no
-- browser role may claim, finalize, or release. RLS alone is never relied on,
-- because the service-role caller bypasses it.
begin;

alter table public.messages
  add column if not exists send_claim_token uuid,
  add column if not exists send_claim_issued_at timestamptz;

-- A claim is an indivisible (token, issued-at) pair; partial states are not
-- possible. This also gives operators a durable flag for manual recovery.
alter table public.messages
  drop constraint if exists messages_send_claim_pair_check,
  add constraint messages_send_claim_pair_check
    check (
      (send_claim_token is null and send_claim_issued_at is null)
      or
      (send_claim_token is not null and send_claim_issued_at is not null)
    );

create index if not exists messages_send_claim_token_idx
  on public.messages (send_claim_token)
  where send_claim_token is not null;

create or replace function public.claim_outbound_message_send(
  p_message_id uuid,
  p_owner_user_id uuid
)
returns table (claim_token uuid, reason text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token uuid;
  v_user_id uuid;
  v_direction text;
  v_status text;
  v_has_claim boolean;
  v_conversation_id uuid;
  v_conversation_user uuid;
  v_conversation_workspace uuid;
  v_message_workspace uuid;
  v_opted_out_at timestamptz;
  v_automation_mode text;
  v_human_takeover_at timestamptz;
begin
  update public.messages m
  set send_claim_token = pg_catalog.gen_random_uuid(),
      send_claim_issued_at = pg_catalog.now()
  from public.conversations c
  where c.id = m.conversation_id
    and m.id = p_message_id
    and m.user_id = p_owner_user_id
    and c.user_id = p_owner_user_id
    and c.workspace_id = m.workspace_id
    and m.direction = 'outbound'
    and m.status in ('draft_blocked', 'failed')
    and m.send_claim_token is null
    and c.customer_opted_out_at is null
    and (c.automation_mode is distinct from 'human' or c.human_takeover_at is null)
  returning m.send_claim_token into v_token;

  if found then
    claim_token := v_token;
    reason := 'claimed';
    return next;
    return;
  end if;

  -- No row was claimable. Classify honestly, checking ownership BEFORE any
  -- state detail so another user's message is never distinguishable.
  select m.user_id, m.direction, m.status, (m.send_claim_token is not null),
         m.workspace_id, m.conversation_id
    into v_user_id, v_direction, v_status, v_has_claim,
         v_message_workspace, v_conversation_id
  from public.messages m
  where m.id = p_message_id;
  if not found or v_user_id is distinct from p_owner_user_id then
    reason := 'not_found';
    return next;
    return;
  end if;
  if v_has_claim then
    reason := 'already_claimed';
    return next;
    return;
  end if;
  if v_direction <> 'outbound' or v_status not in ('draft_blocked', 'failed') then
    reason := 'not_draft';
    return next;
    return;
  end if;

  select c.user_id, c.workspace_id, c.customer_opted_out_at, c.automation_mode,
         c.human_takeover_at
    into v_conversation_user, v_conversation_workspace, v_opted_out_at,
         v_automation_mode, v_human_takeover_at
  from public.conversations c
  where c.id = v_conversation_id;
  if not found or v_conversation_user is distinct from p_owner_user_id then
    reason := 'not_found';
    return next;
    return;
  end if;
  if v_conversation_workspace is distinct from v_message_workspace then
    reason := 'ineligible';
    return next;
    return;
  end if;
  if v_opted_out_at is not null then
    reason := 'opted_out';
    return next;
    return;
  end if;
  if v_automation_mode = 'human' or v_human_takeover_at is not null then
    reason := 'human_takeover';
    return next;
    return;
  end if;

  reason := 'ineligible';
  return next;
end $$;

revoke all on function public.claim_outbound_message_send(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_outbound_message_send(uuid, uuid)
  to service_role;

-- Record a real send. Only the session that holds the matching claim token can
-- finalize; the token is cleared and the status flips to 'sent'. A mismatched
-- or already-cleared token changes nothing.
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
      template_name = pg_catalog.coalesce(p_template_name, m.template_name),
      send_claim_token = null,
      send_claim_issued_at = null
  where m.id = p_message_id
    and m.user_id = p_owner_user_id
    and m.send_claim_token = p_claim_token
    and m.wa_message_id is null
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

-- Cancel an unused claim so the draft can be retried. Only the exact token
-- holder can release; a different caller can never silently steal the claim,
-- and a released-then-reclaimed draft is a fresh, eligible claim.
create or replace function public.release_outbound_message_send(
  p_message_id uuid,
  p_claim_token uuid,
  p_owner_user_id uuid
)
returns table (released boolean, reason text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exists boolean;
begin
  update public.messages m
  set send_claim_token = null,
      send_claim_issued_at = null
  where m.id = p_message_id
    and m.user_id = p_owner_user_id
    and m.send_claim_token = p_claim_token
    and m.status in ('draft_blocked', 'failed');

  if found then
    released := true;
    reason := 'released';
    return next;
    return;
  end if;

  select exists (
    select 1 from public.messages m
    where m.id = p_message_id and m.user_id = p_owner_user_id
  ) into v_exists;
  if not v_exists then
    released := false;
    reason := 'not_found';
    return next;
    return;
  end if;

  released := false;
  reason := 'claim_mismatch';
  return next;
end $$;

revoke all on function public.release_outbound_message_send(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_outbound_message_send(uuid, uuid, uuid)
  to service_role;

commit;

-- Rollback guidance: keep WHATSAPP_OUTBOUND_ENABLED false. To roll back, drop
-- the three RPCs at their declared signatures, then the partial index, the pair
-- check constraint, and the two claim columns. Preserve any 'sent' rows and
-- outbound audit events already recorded; treat claimed-but-unsent rows as
-- needs-manual-review rather than silently sending them.