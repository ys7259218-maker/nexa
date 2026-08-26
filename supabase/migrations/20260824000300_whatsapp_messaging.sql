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
