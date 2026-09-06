-- Outbound approve-and-send audit trail.
-- Apply after the audit_events, outbound_sent_status, and outbound_template_name
-- migrations. Widens audit_events.entity_type to accept 'message' and records an
-- immutable audit row whenever a message transitions to 'sent' through the
-- human-approved outbound path.
--
-- The trigger runs under a security-definer function (search_path pinned) so the
-- service-role update that sets status='sent' is captured even though no client
-- policy allows writes. Reads remain gated by the existing workspace-members
-- read policy on audit_events. The audit row never includes message body text;
-- metadata only carries ids, status, the optional template reference, and timing.
begin;

alter table public.audit_events
  drop constraint if exists audit_events_entity_type_new_check;

-- Inject 'message' into the entity_type allow-list. The constraint is recreated
-- identically except for the new value; nothing else about it changes.
alter table public.audit_events
  add constraint audit_events_entity_type_new_check
  check (
    entity_type in ('ai_employee', 'workspace', 'integration', 'message')
  );

create or replace function public.audit_outbound_message_sent()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_workspace_id uuid;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;
  if new.status <> 'sent' then
    return new;
  end if;

  -- 'sent' rows are written by the service-role outbound processor, so there is
  -- no auth.uid() actor to attribute. Resolve the workspace from the owning
  -- conversation so the read policy can scope the audit row.
  select workspace_id into target_workspace_id
    from public.conversations
   where id = new.conversation_id;

  if target_workspace_id is not null then
    insert into public.audit_events (
      workspace_id, actor_user_id, entity_type, entity_id, action, metadata
    ) values (
      target_workspace_id,
      null,
      'message',
      new.id,
      'outbound_message_sent',
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'wa_message_id', new.wa_message_id,
        'template_name', new.template_name,
        'sent_at', new.sent_at,
        'conversation_id', new.conversation_id
      )
    );
  end if;

  return new;
end $$;

revoke all on function public.audit_outbound_message_sent() from public;

drop trigger if exists audit_outbound_message_sent on public.messages;
create trigger audit_outbound_message_sent
  after update of status on public.messages
  for each row execute function public.audit_outbound_message_sent();

commit;