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
