-- PROPOSAL ONLY. NOT APPLIED. Staging rollback-tested before any migration use.
-- Explicit booking approval is separate from approved_for_manual_followup.
create table public.appointment_booking_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  review_request_id uuid not null unique references public.appointment_review_requests(id) on delete restrict,
  review_decision_id uuid not null unique references public.appointment_review_decisions(id) on delete restrict,
  customer_confirmation_message_id uuid not null unique references public.messages(id) on delete restrict,
  approved_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now()
);
alter table public.appointment_booking_approvals enable row level security;
revoke all on public.appointment_booking_approvals from anon, authenticated;
grant select, insert on public.appointment_booking_approvals to authenticated;

create policy "Owners and admins read booking approvals"
on public.appointment_booking_approvals for select to authenticated
using (
  (select auth.uid()) is not null
  and workspace_has_role(appointment_booking_approvals.workspace_id, array['owner','admin'])
);

create policy "Owners and admins explicitly approve verified customer confirmations"
on public.appointment_booking_approvals for insert to authenticated
with check (
  (select auth.uid()) is not null
  and appointment_booking_approvals.approved_by_user_id = (select auth.uid())
  and workspace_has_role(appointment_booking_approvals.workspace_id, array['owner','admin'])
  and exists (
    select 1
    from public.appointment_review_requests r
    join public.appointment_review_decisions d
      on d.review_request_id = r.id and d.workspace_id = r.workspace_id
    join public.messages m
      on m.id = appointment_booking_approvals.customer_confirmation_message_id
      and m.workspace_id = r.workspace_id
      and m.conversation_id = r.conversation_id
      and m.direction = 'inbound'
    where r.id = appointment_booking_approvals.review_request_id
      and r.workspace_id = appointment_booking_approvals.workspace_id
      and d.id = appointment_booking_approvals.review_decision_id
      and d.decision = 'approved_for_manual_followup'
      and m.id <> r.inbound_message_id
      and m.created_at >= r.created_at
  )
);

create table public.appointment_booking_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  review_request_id uuid not null unique references public.appointment_review_requests(id) on delete restrict,
  booking_approval_id uuid not null unique references public.appointment_booking_approvals(id) on delete restrict,
  idempotency_key text not null unique,
  status text not null check (status in ('claimed','confirmed','failed')),
  provider text,
  provider_booking_id text,
  starts_at timestamptz,
  failure_code text,
  claimed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (char_length(idempotency_key) between 1 and 300),
  check (
    (status='claimed' and provider is null and provider_booking_id is null and starts_at is null and confirmed_at is null)
    or
    (status='confirmed' and provider is not null and provider_booking_id is not null and starts_at is not null and confirmed_at is not null and failure_code is null)
    or
    (status='failed' and provider_booking_id is null and confirmed_at is null and failure_code is not null)
  )
);
alter table public.appointment_booking_attempts enable row level security;
revoke all on public.appointment_booking_attempts from anon, authenticated;
grant select on public.appointment_booking_attempts to authenticated;

create policy "Owners and admins read booking attempts"
on public.appointment_booking_attempts for select to authenticated
using (
  (select auth.uid()) is not null
  and workspace_has_role(appointment_booking_attempts.workspace_id, array['owner','admin'])
);

-- Important: authenticated has NO INSERT/UPDATE/DELETE grant on attempts.
-- Writes are reserved for a future server-only privileged adapter after it
-- independently validates the authenticated user and approval chain.
