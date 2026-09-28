# Staging-Only Google Calendar OAuth Connection — Reviewed Plan

Status (2026-09-27 20:15 UTC): **merged in `main` at `c2b2120`; staging table exists; staging OAuth client created; Preview gate reaches authentication, but OAuth is not end-to-end verified.** An earlier READY Preview returned gate-off `404 {"error":"not_found"}`. After Preview-only configuration, READY deployment `dpl_bz9ESE1hC9NWKoXMMb73rqyEUAbZ` returned unauthenticated `401 {"error":"unauthenticated"}` from `/connect`. This proves the gate and auth boundary, not consent, connection, token decryption, or a calendar write. This is the operator checklist for connecting a
*dedicated staging test calendar* to Nexa on staging Preview only.

## Scope and hard boundaries

- Exposed **only** on staging preview: `GOOGLE_CALENDAR_STAGING_ENABLED=true` AND
  `NEXT_PUBLIC_SUPABASE_URL` is exactly `https://vbizuxxgjlwqotuegskq.supabase.co`
  AND `VERCEL_ENV !== "production"` (gate: `lib/calendar/googleCalendarGate.ts`).
- OAuth scope is **only** `https://www.googleapis.com/auth/calendar.events.owned`
  (events this account owns). The flow **never** calls `calendarList.list`, never
  auto-selects a calendar, and an event is **never** created.
- **No default calendar:** `calendar_oauth_connections.calendar_id` has no default
  and stays `NULL` until an operator explicitly stores a calendar id via
  `POST /api/integrations/google-calendar/configure`. The deployed `c2b2120`
  implementation does not itself reject an explicitly supplied `primary` alias;
  PR #218 adds that guard but is not merged as of this checkpoint. Do not
  configure any calendar until the guard is merged and verified, and a dedicated
  staging test calendar id is independently checked.
- Server-only token storage: tokens are AES-256-GCM encrypted at rest (envelope
  `v1.iv.tag.cipher`, base64url) and written/updated/deleted only through the
  service-role client; browser `authenticated` and `anon` roles are limited to
  `SELECT` (owner/admin via `workspace_has_role`).
- No client secret is requested or created by this repo. Without a valid
  `GOOGLE_CALENDAR_CLIENT_SECRET` and token key, connect fails closed (`503
  oauth_not_configured`). Under the owner's staging setup approval, the designated
  provider executor added a staging-only token key as a sensitive Preview variable.
  Independent metadata confirms its name and Preview target, not its value or
  authenticated use. No separately verified recovery escrow exists for this key;
  future token loss would require reconnect.
- Production OAuth activation, WhatsApp/outbound, Meta and customer sends remain
  outside this staging flow.

## Redirect URI (exact, for Google Cloud)

```
https://nexa-staging-e97cptb4i-skld.vercel.app/api/integrations/google-calendar/callback
```

This is the earlier PR Preview URI reported as registered by the owner. The
current READY gate-on Preview host is `nexa-staging-cbr8nuxuh-skld.vercel.app`,
whose callback URI has **not** been verified as registered with Google. The
implementation derives the redirect URI from the exact host receiving `/connect`,
so that new Preview hostname requires a matching Google Cloud callback URI before
consent. Never use a production hostname. Route source-of-truth:
`app/api/integrations/google-calendar/connect/route.ts` and `CALLBACK_PATH`.

## Environment (server-only, see `.env.example` block)

| Variable                              | Purpose                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `GOOGLE_CALENDAR_STAGING_ENABLED`     | gate flag; `"true"` on staging, must stay `false` elsewhere     |
| `GOOGLE_CALENDAR_CLIENT_ID`           | staging OAuth client id (owner-created)                        |
| `GOOGLE_CALENDAR_CLIENT_SECRET`       | staging OAuth client secret (owner-created; Preview only)      |
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

## Operator checklist (verify against the live staging environment)

1. The staging table exists by direct catalog query. Reconcile the
   dashboard-applied schema with the canonical file and migration history before
   claiming replay parity.
2. Create a dedicated staging test calendar in Google (not `primary`).
3. The owner created a Google Cloud OAuth client. Verify its allowed redirect
   URI matches the exact Preview host used for `/connect`. Keep credentials out
   of chat; scope remains `calendar.events.owned`.
4. Earlier Preview metadata lacked the token key and staging Supabase URL/key,
   and its `/connect` returned gate-off `404`. Under the owner's staging setup
   approval, the designated provider executor added only staging credentials
   and a new sensitive staging token key at Preview scope. Value-free metadata
   confirms six required Preview names; fresh READY deployment
   `dpl_bz9ESE1hC9NWKoXMMb73rqyEUAbZ` returned unauthenticated `401`.
   Do not confuse this with authenticated OAuth proof, and never copy production
   credentials or reveal secret values.
5. Before consent, verify the exact new Preview callback URI in Google Cloud,
   merge and verify PR #218's `primary`-alias guard, and settle a staging-key
   recovery/reconnect policy. Obtain separate approval for real Google consent.
6. Only then connect via the UI and `POST …/configure` with a verified dedicated
   test-calendar id. Verify `GET …/status` shows the expected `calendarId` and
   scope, and that no real event has been created anywhere.

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