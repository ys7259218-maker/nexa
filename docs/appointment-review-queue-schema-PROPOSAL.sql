-- PROPOSAL ONLY: NOT a canonical Supabase migration and NOT applied anywhere.
-- Review tenant isolation, existing-table grants/policies, synthetic two-actor
-- RLS proof and rollback before generating a timestamped migration using the CLI.
-- This is intentionally a separate queue from public.appointments (bookings).
--
-- The current authenticated-user adapter requires insert/select, and expects a
-- UNIQUE(workspace_id,inbound_message_id) conflict to be returned as 23505.
-- Do not grant UPDATE/DELETE, add a "confirmed" status or call an external API.

begin;

-- Refuse to co-opt or replace any existing table, rather than silently
-- accepting an incompatible structure with CREATE TABLE IF NOT EXISTS.
do $$ begin
  if to_regclass('public.appointment_review_requests') is not null then
    raise exception 'review queue already exists; manually review its complete schema before any changes';
  end if;
end $$;

create table public.appointment_review_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  inbound_message_id uuid not null references public.messages(id) on delete cascade,
  requested_at timestamptz not null,
  customer_request text not null check (
    char_length(customer_request) between 1 and 1000
    and customer_request !~ '[[:cntrl:]]'
    and btrim(customer_request) <> ''
  ),
  status text not null default 'pending_review'
    check (status = 'pending_review'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint appointment_review_requests_workspace_inbound_unique
    unique(workspace_id,inbound_message_id)
);

create index appointment_review_requests_workspace_created_idx
  on public.appointment_review_requests(workspace_id,created_at desc);

alter table public.appointment_review_requests enable row level security;
revoke all on public.appointment_review_requests from public, anon, authenticated;
grant select, insert on public.appointment_review_requests to authenticated;

create policy "Authorized operators read pending appointment reviews"
  on public.appointment_review_requests for select to authenticated
  using (
    (select auth.uid()) is not null
    and public.workspace_has_role(workspace_id,array['owner','admin','operator']::text[])
  );

create policy "Authorized operators request inbound appointment review"
  on public.appointment_review_requests for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and public.workspace_has_role(workspace_id,array['owner','admin','operator']::text[])
    and exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = inbound_message_id
        and m.workspace_id = workspace_id
        and m.conversation_id = conversation_id
        and m.direction = 'inbound'
        and c.id = conversation_id
        and c.workspace_id = workspace_id
    )
  );

-- No UPDATE or DELETE policies/grants. An approval/booking transition requires
-- a separate audited implementation and human-reviewed release gate.
-- The transaction boundary must remain all-or-nothing for any eventual rollout.
commit;
