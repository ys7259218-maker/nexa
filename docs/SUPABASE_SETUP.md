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

## Data layer

All reads and writes go through typed modules using the signed-in user's cookie session:

- `lib/aiEmployees.ts` — list/get/create/update/delete for `ai_employees`, including all settings and knowledge-base metadata columns
- `lib/dashboard.ts` — `getDashboardSnapshot` reads the owner's `calls`, `appointments`, and `activity_events` rows to derive metrics, weekly chart data, recent calls, upcoming appointments, and the activity feed; `recordActivityEvent` appends feed entries

Ownership is enforced by the RLS policies above; the application never uses the service-role key and never filters by `user_id` in client code. Integration tests for these policies live in `tests/integration/` (skipped without a dedicated test project).

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally. Never expose the service-role key to the browser. Confirm RLS is enabled before using real customer data.
