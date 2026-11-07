# Staging Google Calendar OAuth — Live Consent Runbook

Goal: complete the **first real OAuth consent** on the staging preview only
(`nexa-staging`), store the encrypted connection server-only, verify end-to-end,
then configure a dedicated test calendar and disconnect (cleanup). Everything
sanitized — no token values, no client secret, no workspace PII, no real events.

## Verified state (2026-09-30)

- Production `nexa-skld.vercel.app` live, `/api/health` 200, Google routes
  return `404 {"error":"not_found"}` = gate OFF in production.
- `public.calendar_oauth_connections` exists on staging (owner applied via
  dashboard; catalog evidence in `docs/STAGING_SCHEMA_RECONCILE_20260928.md`).
- Staging OAuth client created by owner; all six env names exist at
  `nexa-staging` Preview scope (value-free metadata verified): enabled flag,
  client id, client secret, token key, staging Supabase URL, anon key.
- Gate proof (2026-09-27): fresh preview `nexa-staging-cbr8nuxuh-skld.vercel.app`
  (head `ea893e6`) returned app-level `401 {"error":"unauthenticated"}` at
  `/api/integrations/google-calendar/connect`.
- **Blocker (new, 2026-09-30):** Vercel deployment protection is ON for staging
  previews — unprotected clients get `302` (Vercel Authentication / SSO
  challenge). **Unblocked** with a fresh owner token: authenticated `vercel curl`
  reaches the preview normally (see evidence below).
- Callback is Google-registered only for
  `nexa-staging-e97cptb4i-skld.vercel.app` (PR #215 artifact). Whether the
  active host `nexa-staging-cbr8nuxuh-skld.vercel.app` is registered is
  unconfirmed — the owner believes yes; the consent screen visit decides.
- Staging has 0 OAuth connections, 0 configured calendar IDs (verified).
- **Resolved mystery:** the recurring `nexa-staging` / `nexa-8rk5` production
  build failures are **by design**, not a bug — `lib/productionGuard.ts`
  (`inspectProductionBuild`) makes any `VERCEL_ENV=production` build fail
  closed unless `PRODUCTION_RELEASE_APPROVED=nexa-production-approved-v1` is
  present, and always rejects production builds pointed at the staging Supabase
  ref. The secondary projects deliberately lack the release signal. The primary
  `nexa` production build passes (signal present, closed-beta flags off).

## Evidence (2026-09-30, authenticated `vercel curl` with fresh owner token)

- Token valid (`ys7259218-7545`, team `skld`); all 6 staging env names confirmed
  at `nexa-staging` **preview** scope (values untouched); `nexa-staging`
  production scope has **no** `GOOGLE_CALENDAR_*` vars — prod gate stays off.
- `vercel curl https://nexa-staging-cbr8nuxuh-skld.vercel.app/api/health` →
  `200 {"status":"ready"}`.
- `vercel curl -i .../api/integrations/google-calendar/connect` →
  `401 {"error":"unauthenticated"}` with `X-Matched-Path`
  `/api/integrations/google-calendar/connect` — gate passes, auth enforced,
  all 6 vars present.
- The secondary projects' production-build `ERROR`s carry
  `Command "npm run build" exited with 1` → "Vercel production build blocked by
  the production-readiness guard" (by design, see above).

## Owner action-slip (exact steps)

Remaining owner work is a **single consent visit** (token path already proven):

1. **Vercel token (done):** fresh `verify-staging` token provided; used read-only;
   never printed/written. (Keeping it only unblocks authenticated probes; if it
   is revoked, renew it the same way.)
2. **Consent (the one manual step):**
   a. Signed in as a workspace **owner/admin** on the staging app, visit
      `https://nexa-staging-cbr8nuxuh-skld.vercel.app/api/integrations/google-calendar/connect`.
   b. If the **Google consent screen** appears → callback IS registered;
      approve only `calendar.events.owned`.
   c. If **`redirect_uri_mismatch`** appears → register the exact URI
      `https://nexa-staging-cbr8nuxuh-skld.vercel.app/api/integrations/google-calendar/callback`
      in the Google Cloud OAuth client, then retry (b).
3. Expected redirect after approval: `/settings/team?calendar=connected`.

The old fallback (toggling `nexa-staging` Deployment Protection off) is no
longer necessary — authenticated `vercel curl` reaches protected deployments.

2. **Google Cloud — register the callback for the active preview host:**
   Authorized redirect URI exactly
   `https://nexa-staging-cbr8nuxuh-skld.vercel.app/api/integrations/google-calendar/callback`.
   Source of truth for the path: `app/api/integrations/google-calendar/callback/route.ts`
   and `lib/calendar/googleOAuth.ts` (`CALLBACK_PATH`). The route builds the URI as
   `<origin>/api/integrations/google-calendar/callback` (`callback/route.ts:61`).
   - Optional: instead, spin a fresh preview from `origin/main` (incl. PR #218
     primary-alias guard) by opening a PR, then register THAT host's callback.
     Previews are PR-gated; bare branch pushes do not build.

3. **Consent with a dedicated test Gmail** (owner/admin of a workspace):
   signed in → open `/api/integrations/google-calendar/connect` → approve the
   `calendar.events.owned` consent screen only. Expect redirect
   `/settings/team?calendar=connected`.

## After-action verification checklist (run by operator/OpenCode)

Reachability (host `nexa-staging-cbr8nuxuh-skld.vercel.app`):

- `/api/health` → 200 `{"status":"ready"}`
- `GET /api/integrations/google-calendar/connect` unauthenticated → app 401
  (gate + auth layer) — proves gate still ON after protection toggle
- After login, `/connect` → 302 to `accounts.google.com` with
  `scope=https://www.googleapis.com/auth/calendar.events.owned&access_type=offline&prompt=consent&code_challenge_method=S256`

Post-consent (no token values ever printed):

- Redirect lands `calendar=connected` (not `calendar=error`)
- `GET /api/integrations/google-calendar/status` → connected, `calendarId`
  absent (NULL), scope byte-exact, **no token fields in response**
- Optional token-decrypt proof: no — row is server-only (`service_role`);
  authenticated/anon have SELECT only; do not expose keys to do so
- `POST /api/integrations/google-calendar/configure` with a dedicated staging
  test calendar id (never `'primary'`; #218 guard rejects it) → status shows it
- `POST /api/integrations/google-calendar/disconnect` → status disconnected;
  aggregate count back to 0

## Hard boundaries (never)

- No production OAuth activation; no `calendarList.list`; no default/primary
  calendar; no event creation; no outbound enablement; no production deployment
  protection changes; no credentials pasted anywhere.

## Open items (document before productionizing)

- Token-key recovery escrow is not independently verified; a decrypt/rotation
  drill using the server key is a separate owner-gated task.
- Active preview host changes require callback re-registration each time.