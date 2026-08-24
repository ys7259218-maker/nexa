# Supabase setup

Create the table in Supabase SQL Editor before using the AI employee form. This baseline keeps each user isolated with Row Level Security.

```sql
create table if not exists public.ai_employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  business_name text not null check (char_length(business_name) between 1 and 160),
  phone text not null default '',
  voice text not null default 'Female',
  language text not null default 'English',
  status text not null default 'Offline' check (status in ('Active', 'Offline')),
  created_at timestamptz not null default now()
);

alter table public.ai_employees enable row level security;

create policy "Users read their own AI employees" on public.ai_employees for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their own AI employees" on public.ai_employees for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own AI employees" on public.ai_employees for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own AI employees" on public.ai_employees for delete to authenticated using ((select auth.uid()) = user_id);
```

For tables created before the `status` column existed, run this migration:

```sql
alter table public.ai_employees
  add column if not exists status text not null default 'Offline';

alter table public.ai_employees
  add constraint ai_employees_status_check check (status in ('Active', 'Offline'))
  not valid;

alter table public.ai_employees
  validate constraint ai_employees_status_check;
```

## Settings and dashboard migration (required)

The application reads and writes these columns and tables. Run this in the SQL Editor once per project; every statement is safe to re-run.

```sql
-- Additional AI employee settings persisted by General/Voice/Phone/Knowledge cards
alter table public.ai_employees
  add column if not exists department text not null default '',
  add column if not exists business_description text not null default '',
  add column if not exists greeting_message text not null default '',
  add column if not exists timezone text not null default '',
  add column if not exists working_hours text not null default '',
  add column if not exists accent text not null default '',
  add column if not exists speaking_style text not null default '',
  add column if not exists speaking_speed text not null default '',
  add column if not exists tone text not null default '',
  add column if not exists country text not null default '',
  add column if not exists business_hours text not null default '',
  add column if not exists call_forwarding_number text not null default '',
  add column if not exists call_routing_rule text not null default '',
  add column if not exists knowledge_website text not null default '',
  add column if not exists knowledge_faq_document text not null default '',
  add column if not exists knowledge_pdf_url text not null default '',
  add column if not exists knowledge_notes text not null default '';

-- Call log (populated by a future telephony runtime; dashboard reads it today)
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ai_employee_id uuid references public.ai_employees(id) on delete set null,
  customer text not null default '',
  status text not null default 'Completed' check (status in ('Completed', 'Booked', 'Missed')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

-- Appointments booked by AI employees (populated by a future booking runtime)
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ai_employee_id uuid references public.ai_employees(id) on delete set null,
  customer text not null default '',
  service text not null default '',
  location text not null default '',
  scheduled_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Confirmed', 'Pending')),
  created_at timestamptz not null default now()
);

-- Activity feed entries (written when employees are created, deleted, or go live)
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null default 'general' check (category in ('general', 'calls', 'appointments', 'whatsapp')),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

-- Row Level Security: every table is scoped to its owner
alter table public.calls enable row level security;
alter table public.appointments enable row level security;
alter table public.activity_events enable row level security;

create policy "Users read their own calls" on public.calls for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own calls" on public.calls for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users read their own appointments" on public.appointments for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own appointments" on public.appointments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own appointments" on public.appointments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users read their own activity" on public.activity_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own activity" on public.activity_events for insert to authenticated with check ((select auth.uid()) = user_id);
```

## WhatsApp messaging migration (required before webhook processing)

Additive migration for conversations, messages, and the webhook event ledger. Run once per project; every statement is safe to re-run and no existing tables are altered.

```sql
-- Channels link a Meta phone number id to the owning account (owner-managed)
create table if not exists public.whatsapp_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  phone_number_id text not null unique,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One conversation per owner + end-customer WhatsApp id
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ai_employee_id uuid references public.ai_employees(id) on delete set null,
  customer_wa_id text not null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, customer_wa_id)
);

-- Message history; wa_message_id is Meta's immutable id and is the second
-- deduplication layer. user_id is denormalized so RLS needs no joins.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  wa_message_id text unique,
  message_type text not null default 'text',
  body text not null default '',
  status text not null default 'received'
    check (status in ('received', 'delivered', 'read', 'failed', 'draft_blocked')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Durable ledger for inbound webhook events. Minimal normalized payload
-- columns (no raw envelopes) allow replay after failure; purge regularly.
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_kind text not null default 'message',
  phone_number_id text not null default '',
  from_wa_id text not null default '',
  profile_name text not null default '',
  message_type text not null default 'text',
  message_body text not null default '',
  occurred_at timestamptz,
  status text not null default 'claimed'
    check (status in ('claimed', 'processed', 'skipped', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text not null default '',
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.whatsapp_channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.webhook_events enable row level security;

create policy "Owners manage their WhatsApp channels" on public.whatsapp_channels for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners read their conversations" on public.conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read their messages" on public.messages for select to authenticated using ((select auth.uid()) = user_id);
-- webhook_events intentionally has NO policies: it is opaque to every client.
-- Only the server-only service-role connection used by the webhook processor touches it.

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists conversations_owner_recent_idx
  on public.conversations (user_id, last_message_at desc);
create index if not exists webhook_events_status_received_idx
  on public.webhook_events (status, received_at);
```

Transaction safety: Supabase REST calls from the processor are not wrapped in a single database transaction. Correctness instead comes from two unique constraints — `webhook_events.event_id` (claim via `ON CONFLICT DO NOTHING`) and `messages.wa_message_id` — so at-least-once delivery collapses to effectively-once processing, and interrupted runs resume through `retryFailedWebhookEvents`.

Retention: `webhook_events` is an operational ledger, not history. Purge rows older than seven days, for example with pg_cron:

```sql
select cron.schedule('purge-webhook-events', '0 3 * * *',
  $$delete from public.webhook_events where received_at < now() - interval '7 days'$$);
```

Rollback guidance: everything here is additive. To undo, stop the app, then run:

```sql
drop table if exists public.webhook_events;
drop table if exists public.messages;
drop table if exists public.conversations;
drop table if exists public.whatsapp_channels;
```

## Workspace tenancy foundation (Phase 1, additive)

Run this additive migration before enabling workspace UI. It creates one personal workspace for every existing/new account without changing ownership of existing business rows yet.

```sql
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.workspace_members
  where workspace_id = target_workspace_id and user_id = (select auth.uid())
) $$;

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create policy "Members read their workspaces" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy "Members read workspace membership" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- Backfill exactly one personal workspace for existing users without one.
do $$
declare account record; new_workspace_id uuid;
begin
  for account in select id, email from auth.users loop
    if not exists (select 1 from public.workspace_members where user_id = account.id) then
      insert into public.workspaces (name, created_by)
      values (coalesce(nullif(split_part(account.email, '@', 1), ''), 'My') || '''s Workspace', account.id)
      returning id into new_workspace_id;
      insert into public.workspace_members (workspace_id, user_id, role)
      values (new_workspace_id, account.id, 'owner');
    end if;
  end loop;
end $$;

create or replace function public.bootstrap_user_workspace()
returns trigger language plpgsql security definer set search_path = public
as $$
declare new_workspace_id uuid;
begin
  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My') || '''s Workspace', new.id)
  returning id into new_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');
  return new;
end $$;

drop trigger if exists create_workspace_after_signup on auth.users;
create trigger create_workspace_after_signup
after insert on auth.users for each row execute function public.bootstrap_user_workspace();

create index if not exists workspace_members_user_idx on public.workspace_members (user_id, created_at);
```

This is intentionally stage one: existing tables remain protected by their proven `user_id` policies. Add `workspace_id`, backfill, verify tenant-isolation tests, and only then replace those policies in the next migration. Do not remove current ownership policies early.

Stage two is the reviewed cutover script at `docs/migrations/20260824_workspace_tenancy_cutover.sql`. Back up the database first. It runs in one transaction, backfills every current business table, aborts if even one row is unmapped, makes workspace ownership required, adds indexes, and only then replaces legacy policies with member/role policies. Do not paste only part of that script.

After the workspace cutover succeeds, apply `docs/migrations/20260824_employee_lifecycle.sql`. It adds the Draft/Testing/Active/Paused/Archived lifecycle and an automation kill switch. Existing rows migrate fail-safe to Draft or Paused; none become automatically active. Only then set `EMPLOYEE_LIFECYCLE_ENABLED=true` in the deployment environment.

Then apply `docs/migrations/20260824_audit_events.sql`. It creates client-immutable workspace audit history and a database trigger that records lifecycle/kill-switch changes in the same transaction. Verify RLS before setting `AUDIT_LOG_ENABLED=true`.

Finally apply `docs/migrations/20260824_workspace_kill_switch.sql`. It adds the default-paused workspace control, Owner/Admin update policy, and atomic audit trigger. Verify it before setting `WORKSPACE_SAFETY_ENABLED=true`.

Apply `docs/migrations/20260824_team_role_management.sql` before enabling `/settings/team`. It permits Owner/Admin role updates while a trigger prevents membership identity changes, protects the final Owner, and prevents Admin users from granting/removing Owner. Verify with two accounts before setting `TEAM_MANAGEMENT_ENABLED=true`.

## Data layer

All reads and writes go through typed modules using the signed-in user's cookie session:

- `lib/aiEmployees.ts` — list/get/create/update/delete for `ai_employees`, including all settings and knowledge-base metadata columns
- `lib/dashboard.ts` — `getDashboardSnapshot` reads the owner's `calls`, `appointments`, and `activity_events` rows to derive metrics, weekly chart data, recent calls, upcoming appointments, and the activity feed; `recordActivityEvent` appends feed entries
- `lib/whatsappChannels.ts` — owner-scoped CRUD for `whatsapp_channels` (linking a Meta phone number id to an account)
- `lib/whatsappIngest.ts` + `lib/server/whatsappProcessor.ts` — idempotent inbound webhook pipeline writing `webhook_events`, `conversations`, and `messages`

Ownership is enforced by the RLS policies above; browser code only ever uses the anon key. The single exception is the WhatsApp webhook processor, which runs server-side (`import "server-only"`) without a user session and therefore uses `SUPABASE_SERVICE_ROLE_KEY` from server-only environment variables to write rows under the channel owner's account. It is never imported into client code and never exposed through API responses beyond aggregate counts.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally, plus `SUPABASE_SERVICE_ROLE_KEY` (server only) for webhook processing. Never expose the service-role key to the browser or commit it. Confirm RLS is enabled before using real customer data.
