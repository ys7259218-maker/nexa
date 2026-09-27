-- Applied ONLY to staging-test Supabase (vbizuxxgjlwqotuegskq) as migration
-- 20260924180931_appointment_human_decision_staging_v1.
-- NOT part of canonical production migration history.
-- An approved_for_manual_followup decision is NOT a booked appointment and
-- MUST NOT trigger outbound messaging, calendar changes or booking status.
begin;
do $$ begin
  if to_regclass('public.appointment_review_decisions') is not null then
    raise exception 'decision table already exists; manually reconcile schema';
  end if;
end $$;

create table public.appointment_review_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  review_request_id uuid not null unique references public.appointment_review_requests(id) on delete restrict,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved_for_manual_followup','declined')),
  decided_at timestamptz not null default now(),
  constraint appointment_review_decisions_workspace_request_unique unique(workspace_id,review_request_id)
);
create index appointment_review_decisions_workspace_created_idx
 on public.appointment_review_decisions(workspace_id,decided_at desc);
alter table public.appointment_review_decisions enable row level security;
revoke all on public.appointment_review_decisions from public, anon, authenticated;
grant select, insert on public.appointment_review_decisions to authenticated;

create policy "Operators read human review decisions" on public.appointment_review_decisions
for select to authenticated using (
 (select auth.uid()) is not null and
 public.workspace_has_role(workspace_id,array['owner','admin','operator']::text[])
);
create policy "Operators decide on same-workspace pending review" on public.appointment_review_decisions
for insert to authenticated with check (
 (select auth.uid()) is not null and actor_user_id=(select auth.uid()) and
 public.workspace_has_role(workspace_id,array['owner','admin','operator']::text[]) and
 exists (
  select 1 from public.appointment_review_requests r
  where r.id=appointment_review_decisions.review_request_id
   and r.workspace_id=appointment_review_decisions.workspace_id
   and r.status='pending_review'
 )
);
-- No UPDATE/DELETE grants/policies: one immutable, actor-attributed outcome
-- per request. Approval for MANUAL follow-up is not permission to auto-book.
commit;
