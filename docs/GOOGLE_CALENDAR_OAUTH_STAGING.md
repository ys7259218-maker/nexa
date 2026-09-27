# Staging-Only Google Calendar OAuth Connection — Reviewed Plan

Status: **implemented on `codex/appointment-integration-v1`, NOT deployed, NO Google
OAuth client created, NO real calendar writes.** This document is the reviewed
implementation plan and the operator checklist for connecting a *dedicated staging
test calendar* to Nexa on the staging preview environment only.

## Scope and hard boundaries

- Exposed **only** on staging preview: `GOOGLE_CALENDAR_STAGING_ENABLED=true` AND
  `NEXT_PUBLIC_SUPABASE_URL` is exactly `https://vbizuxxgjlwqotuegskq.supabase.co`
  AND `VERCEL_ENV !== "production"` (gate: `lib/calendar/googleCalendarGate.ts`).
- OAuth scope is **only** `https://www.googleapis.com/auth/calendar.events.owned`
  (events this account owns). The flow **never** calls `calendarList.list`, never
  auto-selects a calendar, and an event is **never** created.
- **No default calendar:** `calendar_oauth_connections.calendar_id` has no default
  and stays `NULL` until an operator explicitly stores a dedicated staging test
  calendar id via `POST /api/integrations/google-calendar/configure`. Nexa can
  therefore never write to a personal `primary` calendar.
- Server-only token storage: tokens are AES-256-GCM encrypted at rest (envelope
  `v1.iv.tag.cipher`, base64url) and written/updated/deleted only through the
  service-role client; browser `authenticated` and `anon` roles are limited to
  `SELECT` (owner/admin via `workspace_has_role`).
- No client secret is requested or created by this repo. With
  `GOOGLE_CALENDAR_CLIENT_SECRET` empty, the callback fails closed (`503
  oauth_not_configured` on connect).
- Wholly untouched: production, Vercel, WhatsApp/outbound, Meta, Google OAuth
  console, customer sends.

## Redirect URI (exact, for Google Cloud)

```
https://nexa-staging-preview.vercel.app/api/integrations/google-calendar/callback
```

Heads-up: the production host is `nexa.vercel.app`; that URI is intentionally
**not** used or documented for this staging flow. Route source-of-truth:
`app/api/integrations/google-calendar/callback/route.ts` (`CALLBACK_PATH`).

## Environment (server-only, see `.env.example` block)

| Variable                              | Purpose                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `GOOGLE_CALENDAR_STAGING_ENABLED`     | gate flag; `"true"` on staging, must stay `false` elsewhere     |
| `GOOGLE_CALENDAR_CLIENT_ID`           | staging OAuth client id (owner-created)                        |
| `GOOGLE_CALENDAR_CLIENT_SECRET`       | staging OAuth client secret (owner-created; leave empty now)   |
| `GOOGLE_CALENDAR_TOKEN_KEY`           | 32-byte AES-256-GCM key, 64 hex chars                          |

## Schema — `supabase/migrations/20260927000000_calendar_oauth_connections.sql`

Additive `begin;`/`commit;`. `public.calendar_oauth_connections`:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null unique references public.workspaces(id) on delete cascade`
- `provider text not null default 'google_calendar' check (provider = 'google_calendar')`
- `calendar_id text check (calendar_id is null or char_length(calendar_id) between 3 and 255)` — **no default**
- `access_token_encrypted text not null`, `refresh_token_encrypted text not null`
- `scopes text not null`, `token_expires_at timestamptz not null`
- `connected_by_user_id uuid references auth.users(id) on delete restrict`
- `connected_at`, `updated_at timestamptz not null default now()`

RLS: `enable row level security`; `revoke all … from anon, authenticated`;
`grant select … to authenticated`; single `SELECT` policy for owner/admin via
`workspace_has_role(workspace_id, array['owner','admin'])`. There is **no**
authenticated `INSERT`/`UPDATE`/`DELETE` — browser code can never touch tokens.

## Flow (stages 1–3 + 5 implemented; 4 removed per owner)

1. `GET /api/integrations/google-calendar/connect` — gate + auth (`getUser`) +
   actor owner/admin workspace; PKCE S256 challenge; cookies
   `gcal_oauth_state`/`gcal_oauth_verifier`/`gcal_oauth_wsid`
   (`httpOnly, secure, sameSite=lax, path=/, maxAge=600`); 302 to Google with
   `access_type=offline&prompt=consent`.
2. `GET /api/integrations/google-calendar/callback` — strips cookies, denies on
   `error`/missing fields, constant-time state compare, re-auth + ownership,
   exchanges code+verifier (must include `refresh_token`), encrypts, server-only
   upsert, redirects to `/settings/team?calendar=connected|error`.
3. `POST /api/integrations/google-calendar/configure` — same-origin guard,
   owner/admin, service-role update of `calendar_id`.
4. ~~Calendar picker/list~~ — **removed**. An operator pastes/verifies the id of
   the pre-created dedicated staging test calendar. Never `calendarList.list`.
5. `POST /api/integrations/google-calendar/disconnect` (service-role delete) and
   `GET /api/integrations/google-calendar/status` (sanitized actor RLS read —
   never returns tokens).

## Operator checklist (owner-gated; nothing done here)

1. Apply `supabase/migrations/20260927000000_calendar_oauth_connections.sql` to
   staging via dashboard SQL editor.
2. Create a dedicated staging test calendar in Google (not `primary`).
3. Create the OAuth client in Google Cloud (staging preview), **no** credentials
   pasted in chat; set the exact redirect URI above; add scope
   `calendar.events.owned`.
4. Set the four staging env vars (client secret only once the client exists).
5. Connect via the UI, then `POST …/configure` with the dedicated calendar id.
6. Verify `GET …/status` shows the expected `calendarId` and scope, and that no
   real event has been created anywhere.

## Tests (20, all mocked/contract; no Google or Supabase network)

- `lib/calendar/googleCalendarGate.test.ts` — gate matrix (flag, staging pin,
  production veto, malformed URL).
- `lib/calendar/googleOAuth.test.ts` — token-key validation, AES-GCM
  round-trip/non-determinism/tamper, redirect-URI construction, PKCE S256,
  authorization-URL params (exact scope, offline, consent), token exchange
  success/fail-closed, config fail-closed.
- `lib/server/googleCalendarStoreContract.test.ts` — server-only marker,
  service-role-only writes, status read excludes tokens, no calendar default.
- `lib/actions/googleCalendarSchemaContract.test.ts` — migration continues to
  assert RLS/grants/no-auth-writes/no-primary-default/no security definer.