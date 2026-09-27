-- Staging-only Google Calendar OAuth connection (least-privilege scope
-- https://www.googleapis.com/auth/calendar.events.owned). Tokens are written
-- and deleted ONLY by the server (service_role bypasses RLS); authenticated
-- users read their own workspace connection status only. There is NO default
-- calendar: calendar_id stays NULL until an operator explicitly stores a
-- dedicated staging test-calendar ID after consent, so Nexa cannot
-- accidentally write to a personal primary calendar. Additive and reversible
-- (drop table public.calendar_oauth_connections).
begin;

create table public.calendar_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  provider text not null default 'google_calendar' check (provider = 'google_calendar'),
  calendar_id text check (calendar_id is null or char_length(calendar_id) between 3 and 255),
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  scopes text not null,
  token_expires_at timestamptz not null,
  connected_by_user_id uuid references auth.users(id) on delete restrict,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_oauth_connections enable row level security;
revoke all on public.calendar_oauth_connections from anon, authenticated;
grant select on public.calendar_oauth_connections to authenticated;

create policy "Owners and admins read workspace calendar connection"
on public.calendar_oauth_connections for select to authenticated
using (
  (select auth.uid()) is not null
  and workspace_has_role(calendar_oauth_connections.workspace_id, array['owner','admin'])
);

-- Sole write path is the server (service_role). Authenticated/anon have NO
-- INSERT/UPDATE/DELETE here, so browser code can never touch stored tokens.
commit;