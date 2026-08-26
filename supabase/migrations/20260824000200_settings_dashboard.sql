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
