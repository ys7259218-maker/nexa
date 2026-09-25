# Staging booking-ledger fixture + live adapter run

Date: 2026-09-25. How to produce the last booking milestone's live evidence:
run the real server-only booking adapter against the staging project
(`vbizuxxgjlwqotuegskq`) with dedicated synthetic data, then clean up.

This is staging-only, reversible, and touches **no** real customer data or
production. Prefer, in order:

1. Run the read-only reconcile (`docs/APPOINTMENT_BOOKING_STAGING_RECONCILE.md`)
   to confirm the booking ledger tables are still absent.
2. Apply the booking ledger schema.
3. Seed the fixture chain below.
4. Run the gated adapter runner (`npm run test:integration:booking-ledger-run`).
5. The runner auto-deletes everything it exercised; keep a screenshot/CI log.

## Step 1 — apply the booking ledger schema (staging only, reversible)

In the staging dashboard SQL editor, run
`docs/schema-proposals/appointment_booking_ledger_v1.sql` inside a
`begin; ... commit;` block after a `begin; ... rollback;` dry run. This creates
`appointment_booking_approvals` + `appointment_booking_attempts` with RLS.
This is the only DDL step; it is intentionally `on delete restrict`-guarded and
removable (drop the two tables in reverse order to undo).

## Step 2 — seed the fixture chain (staging SQL editor)

Replace ONLY the single placeholder — the dedicated owner test account email
(the same value as `INTEGRATION_TEST_EMAIL`). Owner user + workspace are
looked up automatically:

```sql
begin;

do $$
declare
  v_actor uuid := (
    select id from auth.users where email = '<INTEGRATION_TEST_EMAIL>'
  );
  v_ws    uuid := (
    select workspace_id from workspace_members
    where user_id = v_actor and role = 'owner' limit 1
  );
  v_conv  uuid;
  v_req   uuid;  -- the original request inbound message
  v_conf  uuid;  -- the separate customer-confirmation inbound message
  v_rev   uuid;  -- review request (marker lives in customer_request)
  v_dec   uuid;  -- approved_for_manual_followup decision
  v_app   uuid;  -- booking approval
begin
  if v_email is null or v_ws is null then
    raise exception 'dedicated staging owner account not found';
  end if;

  insert into public.conversations (user_id, customer_wa_id)
    values (v_actor, 'nexa-staging-fixture-conv-' || gen_random_uuid())
    returning id into v_conv;

  insert into public.messages (conversation_id, user_id, direction, body, created_at)
    values (v_conv, v_actor, 'inbound', 'nexa-staging-fixture: original request message', now() - interval '2 minutes')
    returning id into v_req;

  insert into public.appointment_review_requests
    (workspace_id, conversation_id, inbound_message_id, requested_at, customer_request, created_by, created_at)
    values (
      v_ws,
      v_conv,
      v_req,
      now() + interval '24 hours',
      'nexa-staging-fixture: ' || to_char(now(), 'YYYYMMDDHH24MISSMS') || ' synthetic appointment request',
      v_actor,
      now() - interval '1 minute'
    )
    returning id into v_rev;

  insert into public.messages (conversation_id, user_id, direction, body, created_at)
    values (v_conv, v_actor, 'inbound', 'nexa-staging-fixture: customer confirmation', now())
    returning id into v_conf;

  insert into public.appointment_review_decisions
    (workspace_id, review_request_id, actor_user_id, decision, decided_at)
    values (v_ws, v_rev, v_actor, 'approved_for_manual_followup', now())
    returning id into v_dec;

  insert into public.appointment_booking_approvals
    (workspace_id, review_request_id, review_decision_id, customer_confirmation_message_id, approved_by_user_id, approved_at)
    values (v_ws, v_rev, v_dec, v_conf, v_actor, now())
    returning id into v_app;

  raise notice 'fixture seeded: review=% approval=%', v_rev, v_app;
end $$;

commit;
```

Constraints this satisfies: confirmation is a distinct inbound message created
after the review request; the approval references one approved decision and one
later confirmation in the same workspace/conversation; `requested_at` is 24h in
the future (the executor requires a +60s lead); the review guard requires the
customer confirmation to be after the review's `created_at`.

## Step 3 — run the live adapter

Inject the staging credentials from `.env.local` plus the service-role key, then:

```powershell
$env:INTEGRATION_SUPABASE_URL="https://vbizuxxgjlwqotuegskq.supabase.co"
$env:INTEGRATION_SUPABASE_ANON_KEY="<INTEGRATION_SUPABASE_ANON_KEY>"
$env:INTEGRATION_SUPABASE_SERVICE_ROLE_KEY="<SUPABASE_SERVICE_ROLE_KEY>"
$env:INTEGRATION_TEST_EMAIL="<email>"; $env:INTEGRATION_TEST_PASSWORD="<password>"
npm run test:integration:booking-ledger-run
```

What it proves (only after Step 1 + 2; otherwise it skips with the exact reason):
trusted authorization loads from the RLS-scoped records; the real
server-only `createAppointmentBookingLedger` claims, confirms with a sandbox
provider (no real calendar, no outbound), replays idempotently, and direct
authenticated ledger writes stay denied by RLS.

## Step 4 — optional: expose staging migration history for read-only reconcile

`supabase_migrations.schema_migrations` is not exposed to PostgREST on staging
(406). To let the repo reconcile canonical vs applied migration history
read-only (no management token needed), run this once in the dashboard SQL
editor. It creates a staging-only snapshot table and fills it:

```sql
begin;

drop table if exists public.staging_migrations_snapshot;
create table public.staging_migrations_snapshot (
  version text not null,
  applied_at timestamptz not null
);
insert into public.staging_migrations_snapshot (version, applied_at)
  select version::text, applied_at
  from supabase_migrations.schema_migrations
  order by version::text;
alter table public.staging_migrations_snapshot enable row level security;
create policy "authenticated reads staging migration snapshot"
  on public.staging_migrations_snapshot for select to authenticated
  using ((select auth.uid()) is not null);
grant select on public.staging_migrations_snapshot to authenticated, service_role;

commit;
```

The repo then reads it read-only and diffs it against the canonical
`supabase/migrations/*` chain. It records history only, changes nothing, and is
removable (`drop table public.staging_migrations_snapshot;`).

## Cleanup

The runner deletes every fixture row it touched (attempts, approval, decision,
review, both messages, conversation) in `finally`. If anything is left behind,
remove in FK order: `appointment_booking_attempts`, `appointment_booking_approvals`,
`appointment_review_decisions`, `appointment_review_requests`, `messages`,
`conversations` — all rows carrying the `nexa-staging-fixture` marker.

## Limitations

- This does not test a real calendar provider; the sandbox provider keeps the
  run side-effect-free. Switching to a real provider is a separate owner step.
- The fixture uses the dedicated test account's own workspace; no cross-tenant
  isolation is re-proven here (covered by the review/history auth tests).