# Phase A — Google Calendar Staging Integration Review (Task A3)

**Audit date:** 2026-11-07 · **Mode:** static read-only review of working-tree code + tests; **no OAuth consent, no Google connection, no migration application, no staging/production access.**

## 1. Scope of the in-flight work (uncommitted)

The working tree contains a Google Calendar **staging-first** OAuth connect feature, layered on top of commit `8c70be6`:

- **Modified (tracked):** `app/api/integrations/google-calendar/{connect,configure,disconnect,status,callback}/route.ts`, `app/settings/team/page.tsx`, `lib/calendar/googleCalendarGate.ts` (+ test), `lib/deployPreflight.ts` (+ test).
- **Untracked:** `components/calendar/GoogleCalendarConnection.tsx` (client UI), `docs/STAGING_OAUTH_CONSENT_RUNBOOK.md` (owner runbook).
- **Root strays:** `page.tsx` and `route.ts` at repo root — see `PHASE_A_GIT_INVENTORY.md` §3.2; `route.ts` is byte-identical to the callback route, `page.tsx` renders one line differently. Both classified accidental duplicates; **not deleted** in Phase A.

## 2. Import resolution & route placement (verified, not inferred)

- `typecheck` passed fresh on this working tree today (0 errors — `PHASE_A_VERIFICATION_REPORT.md`), which resolves every import used by these files: `@/lib/calendar/googleCalendarGate`, `@/lib/calendar/googleOAuth`, `@/lib/server/googleCalendarStore`, `@/lib/supabase/{server,service}`, `@/components/calendar/GoogleCalendarConnection` all exist.
- Routes live at the correct App Router paths: `app/api/integrations/google-calendar/*/route.ts`; settings page at `app/settings/team/page.tsx`. The root strays are outside both `app/` and `src/`, so Next does not treat them as routes.
- All five API routes export `runtime = "nodejs"` where needed (`callback`, `connect`, `configure`); `crypto` usage (`node:crypto` in `googleOAuth.ts`) is Node-only — matches.
- The duplicate `CALENDAR_ID` regex was removed from `configure/route.ts` and replaced with the shared `normalizeStagingCalendarId` — single source of truth.

## 3. Security review of the OAuth flow (static)

### 3.1 Gate (`lib/calendar/googleCalendarGate.ts`)

- Staging: enabled **only** with `GOOGLE_CALENDAR_STAGING_ENABLED === "true"` **and** an exact staging Supabase hostname (`vbizuxxgjlwqotuegskq.supabase.co`) — URL must be https, no query/hash/credentials/port/path.
- `VERCEL_ENV === "production"`: requires the explicit `GOOGLE_CALENDAR_PRODUCTION_ENABLED === "true"` **and** a non-staging Supabase URL (new in this working tree). Fail-closed for any malformed URL.
- New tests cover the production branch (staging URL rejected in production, malformed/credentialled URLs rejected). Scheduled/preview contexts keep the staging-only behavior, so **production cannot be enabled implicitly**.

### 3.2 Connect (authorization redirect)

- `runtime nodejs`, no-store; state = 24 random bytes (base64url), PKCE verifier = 32 random bytes, challenge S256; OAuth cookie max-age raised 600s → 3600s (still bounded; long consent screens remain usable).
- Cookie values are HttpOnly, Secure, SameSite=Lax per `oauthCookie()` (verified in diff), and the gate's failure path returns 503 without any redirect target leak.
- Redirect URI is built as `<origin>/api/integrations/google-calendar/callback` after strict origin validation (https, no credentials). Scope locked to `calendar.events.owned` (least privilege; never `calendarList.list`). `prompt=consent` + `access_type=offline` forces a fresh consent + refresh token.

### 3.3 Callback

- Gate-first fail-closed; consumes the three OAuth cookies and **deletes them immediately** (cookie values are single-use in the browser session).
- `state` comparison uses a manual XOR constant-time compare (`safeEqual`, length-guarded first).
- Actor is re-verified server-side (`supabase.auth.getUser()`), then `actorIsOwnerOrAdminOf` is checked **before** any external call — an attacker cannot trigger a token exchange without an authenticated owner/admin of the cookie-bound workspace.
- Token exchange uses PKCE verifier + client secret; any failure returns a neutral error redirect to `/settings/team?calendar=error` — no error details to the browser.
- Tokens are encrypted (`AES-256-GCM` envelope `v1.<iv>.<tag>.<ciphertext>`, random 12-byte IV per secret, 64-hex token key enforced by `readGoogleCalendarConfig`) **before** being saved through the **service-role** client only.
- `readGoogleCalendarConfig` returns null unless client id, client secret, and 64-hex token key are all present → the whole feature fails closed when not configured.

### 3.4 Token storage & status exposure

- `supabase/migrations/20260927000000_calendar_oauth_connections.sql` (tracked 25th migration): table unique per workspace; RLS enabled; `authenticated` gets **SELECT only**, `anon`/`authenticated` have every write privilege revoked; sole write path is service-role.
- `lib/server/googleCalendarStore.ts` is `server-only`; the actor's read path selects only `provider, calendar_id, scopes, token_expires_at, connected_at` — **no token columns can reach the client**; there are contract tests for this (`lib/server/googleCalendarStoreContract.test.ts`).
- Status UI (`GoogleCalendarConnection.tsx`) displays sanitized fields only and calls `/configure` and `/disconnect` with the server-side re-validation (UUID workspace; calendar id normalized server-side).

### 3.5 `primary`-calendar protection

- `normalizeStagingCalendarId` accepts raw explicit calendar IDs (3–255 chars, bounded charset) and **rejects the pseudo-id `primary`**, so a personal primary calendar can never be silently targeted. Note: `origin/main` commit `80cc24c` (`#218 fix: reject primary calendar alias in staging configuration`) contains an equivalent server-side guard; during reconcile both implementations must be unified (git-inventory R6).

### 3.6 Findings & recommendations (no repair applied)

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| F1 | OAuth cookie names are not `__Host-`-prefixed (`gcal_oauth_state` etc.) | Low (hardening) | Documented; owner may adopt `__Host-` prefix later on staging |
| F2 | Exchanged scope is stored but not asserted server-side to equal `calendar.events.owned` before saving | Low (belt-and-braces) | Recommend adding an exact-scope assertion; **not applied** (touches in-flight user code) |
| F3 | No refresh-token flow exists — connections simply expire (`token_expires_at` shown in UI) | Informational | Intentional minimalism; document as a productionizing open item |
| F4 | UTF-8 BOM added at the top of `callback/route.ts` (diff line 1) and missing final newline in `app/settings/team/page.tsx` | Cosmetic | Left untouched (user's uncommitted work) |
| F5 | Root strays `page.tsx` / `route.ts` duplicate app-dir files | Clutter | Left untouched; owner to delete after review |
| F6 | `runbook` notes: active preview host changes require callback re-registration per host | Operational | Owner-runbook item, already documented in `STAGING_OAUTH_CONSENT_RUNBOOK.md` |

## 4. Verified state of gates/migrations (documentation cross-check)

- Production `nexa-skld.vercel.app` historically returned `404 {"error":"not_found"}` on calendar routes (gate OFF) — recorded in the runbook (2026-09-30 evidence). Production scope has no `GOOGLE_CALENDAR_*` env vars, so gate stays off structurally.
- `public.calendar_oauth_connections` was applied to **staging** by the owner via dashboard (2026-09-30 catalog evidence in `docs/STAGING_SCHEMA_RECONCILE_20260928.md` — historical claim; not re-verified here, no DB access in Phase A).
- The deployment preflight changes (`lib/deployPreflight.ts`) are orthogonal to the calendar flow but ride in the same working tree: OpenAI fail-closed acceptance + inbound-variable grouping — tests exist and pass today.

## 5. Owner-dependent blockers

1. **First real consent visit** (staging, owner/admin signed-in) at `https://nexa-staging-cbr8nuxuh-skld.vercel.app/api/integrations/google-calendar/connect`; if `redirect_uri_mismatch`, register the exact callback URI in the Google Cloud OAuth client. (Runbook §"Owner action-slip".)
2. Dedicated **test calendar id** configuration + cleanup disconnect remains owner-gated.
3. Token-key escrow/rotation drill is a separate owner-gated task (runbook "Open items").
4. Any future production consideration is double-gated: `GOOGLE_CALENDAR_PRODUCTION_ENABLED=true` **and** non-staging Supabase URL — a deliberate owner decision item.

## 6. Verification evidence

- `npm run typecheck -- --incremental false` → 0 errors (fresh, includes all modified/untracked calendar files).
- `npm test` → 667/667 pass, including `googleCalendarGate.test.ts` with the new production-gate cases and `googleOAuth`_PKCE/token-crypto tests.
- `npm run check:tracked-secrets` → pass (no secrets tracked; values never inspected).
- No external network/OAuth action performed in Phase A; the only network operation was the read-only `npm audit --json` metadata query (Task A4) and dependency-enabling environment remediation (OneDrive client start, documented in `PHASE_A_VERIFICATION_REPORT.md`).
