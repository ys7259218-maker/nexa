# Nexa project recap

Development follows the durable manager/architect, isolated-branch, external-tool, validation, and GitHub source-of-truth contract in `docs/NEXA_DEVELOPMENT_OPERATING_SYSTEM.md`. Secret-free private source is authorized only for bounded OpenCode implementation and Kimi review; credentials, customer data, and production access remain excluded.

## Current state

The repository is an early Next.js 16 App Router application, not a finished production SaaS. Its visual flows are preserved. Authentication, AI employee CRUD with full settings persistence, the dashboard snapshot, and durable idempotent WhatsApp inbound processing (mock AI replies) all run on Supabase under RLS. No real AI runtime or telephony exists yet, so call/appointment tables start empty and outbound sending stays disabled pending Meta registration.

### Routes

| Route | State |
| --- | --- |
| `/` | In-memory onboarding flow, then dashboard UI (zero-state data) |
| `/login`, `/signup` | Supabase Auth when environment values are configured; signed-in visitors are redirected to `/dashboard` |
| `/dashboard` | Server-side auth gate; metrics, chart, recent calls, appointments, and activity feed load from `calls`, `appointments`, and `activity_events` via `getDashboardSnapshot`, with loading/error/retry states |
| `/dashboard/ai-employees/new` | Server-side auth gate; creates records through the typed data layer, logs activity, lands on the manage page |
| `/ai-employees` | Server-side auth gate; lists the signed-in user's real records with error, empty, and loading states |
| `/ai-employees/[id]` | Server-side auth gate; loads by route ID; General/Voice/Phone/Knowledge cards persist every settings field; delete is wired |
| `/ai-employees/[id]/test` | Protected owner-scoped simulation sandbox; always uses the deterministic safe mock and never sends or saves the entered message or generated draft |
| `/ai-employees/[id]/versions` | Rollout-gated immutable settings history; lists up to 50 owner-scoped snapshots and restores only through a role-checked RPC |
| `/ai-employees/[id]/knowledge` | Rollout-gated structured notes/FAQs with draft/verified state, edit/delete controls, owner-scoped RLS, and honest no-ingestion copy |
| `/conversations` | Server-side auth gate; real owner-scoped WhatsApp inbox with newest conversations, masked customer identifiers, message history, blocked-draft status, and loading/empty/error states |
| `/api/whatsapp/webhook` | Meta verification, signature validation, and durable idempotent inbound processing (ledger dedup, conversation/message storage, mock-AI draft replies); outbound sending stays disabled |
| `POST /api/internal/whatsapp/retry` | Fail-closed internal recovery route; separate 32+ character Bearer secret, constant-time verification, fixed 10-row batch, aggregate-only response, disabled when unconfigured |
| `GET` / `HEAD /api/health` | Public shallow process-readiness response only; exact minimal status, no-store caching, and no provider/environment/configuration disclosure |

All four app surfaces under `/dashboard` and `/ai-employees` are protected twice: `proxy.ts` refreshes sessions and redirects unauthenticated requests to `/login`, and each server page independently calls `requireAuthenticatedUser()`.

## Stabilization completed

- Removed hardcoded cloud client configuration from active source and added `.env.example` placeholders.
- Made missing optional configuration fail safely instead of breaking the production build.
- Added a signed WhatsApp webhook boundary without requiring a registered phone number for local development.
- Marked WhatsApp registration and production deployment honestly as pending instead of showing ready.
- Fixed lint failures and added `typecheck`/`check` scripts.
- Added setup, Supabase RLS, WhatsApp blocker, security, and OpenCode handoff documentation.

## Stabilization completed (employee test sandbox slice)

- Added a protected `/ai-employees/[id]/test` route. The page and its Server Action both require a validated session, and the employee is loaded through the existing cookie-session Supabase client so owner RLS remains the authorization boundary.
- Simulated customer text is validated and bounded on the server. The sandbox constructs `MockAIProvider` directly, never consults `AI_PROVIDER`, never calls an external provider, and bounds the returned draft.
- The interface repeatedly labels the result as a simulation that was not sent or saved. This slice performs no writes, creates no messages, and does not change lifecycle or production flags.
- Focused unit coverage verifies validation, bounded context mapping, forced-mock behavior, and output limits. Live RLS proof still requires the dedicated Supabase integration environment and is not claimed here.

## Stabilization completed in code (employee version history slice)

- Added immutable `ai_employee_versions` snapshots for identity, behavior, voice, phone, and knowledge settings. The database keeps at most 50 snapshots per employee and gives authenticated workspace members read-only RLS access.
- Added a guarded restore RPC limited to Owner/Admin/Operator. It validates employee/version/workspace identity, preserves the current state before restore, and records `employee_version_restored` in the immutable audit trail without changing lifecycle, channel links, or kill switches.
- Added protected `/ai-employees/[id]/versions` UI with honest empty/error/disabled states and an explicit restore confirmation. The route and Server Action independently require authentication and load the employee through the signed-in cookie session.
- The migration and UI remain fail-closed behind `EMPLOYEE_VERSION_HISTORY_ENABLED=false` until the canonical migration and two-account RLS/role/restore checks pass in a dedicated Supabase project.

## Stabilization completed in code (Knowledge v0 slice)

- Added structured per-employee `note` and `faq` records with bounded title/question/content fields, explicit draft/verified state, composite workspace/employee integrity, role-scoped RLS, identity guards, and content-free audit metadata.
- Added protected `/ai-employees/[id]/knowledge` CRUD UI. It clearly states that Nexa does not upload, crawl, embed, or secretly ingest files; draft entries are excluded until the owner explicitly marks them verified.
- Verified FAQs can produce a deterministic bounded draft in the safe sandbox and WhatsApp draft pipeline without calling an AI provider. Other verified entries enter the existing bounded untrusted-data provider context; unverified entries never enter either path.
- The migration and UI remain fail-closed behind `KNOWLEDGE_V0_ENABLED=false` until the canonical migration and two-account Owner/Operator/Viewer/cross-workspace tests pass in a dedicated Supabase project.

## Stabilization completed in code (WhatsApp channel assignment slice)

- Added canonical migration `20260827183015_whatsapp_channel_assignment.sql` and a byte-identical reviewed source. It leaves existing channels unassigned, adds workspace-bound composite employee foreign keys/indexes for channels and conversations, aborts on legacy conversation mismatch, and records content-free assignment audit events.
- Removed the unsafe “oldest active employee” routing fallback. The webhook now loads only the employee explicitly assigned to the receiving channel, safely synchronizes existing conversation metadata after reassignment, and still requires that employee to be Active/unpaused plus the workspace to be unpaused.
- An unassigned channel, disabled rollout flag, missing employee, paused employee, or cross-workspace mismatch fails closed: inbound history is retained, but no AI provider call or outbound draft occurs.
- The AI Employee WhatsApp card shows assignment state and permits linking/reassignment through the signed-in workspace-admin session. `WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED=false` remains the required default until the migration and dedicated multi-account RLS/routing tests pass.

## Stabilization completed in code (local Supabase gate)

- Pinned the official stable Supabase CLI at exact version `2.116.0` in the project lockfile and initialized a committed `supabase/config.toml` with Nexa's local Postgres 17/auth defaults.
- Added `npm run verify:supabase:local`. It refuses any checkout containing a hosted-project link, requires a running Docker engine, starts local Postgres, applies the canonical chain twice with no seed, runs database lint, and lists local migration history.
- Added static contract tests so the CLI cannot silently float, local auth remains aligned to Nexa's 12-character password rule, and remote flags/commands cannot enter the verifier unnoticed.
- The current machine does not have Docker installed, so the actual two-reset database proof remains honestly blocked. No Supabase project was linked and no hosted database was touched.

## Stabilization completed (SSR slice)

- Adopted the `@supabase/ssr` cookie-based client pattern (`lib/supabase/client.ts`, `lib/supabase/server.ts`) and removed the legacy localStorage singleton.
- Added `proxy.ts` (Next.js 16 proxy, formerly middleware) to refresh sessions and optimistically redirect unauthenticated visits away from `/dashboard` and `/ai-employees`.
- `/dashboard` verifies the session server-side via `requireAuthenticatedUser()` in `lib/auth.ts` and passes the signed-in email into the existing UI.

## Stabilization completed (route protection slice)

- Extended server-side `requireAuthenticatedUser()` gates to `/dashboard/ai-employees/new`, `/ai-employees`, and `/ai-employees/[id]`; the create form moved verbatim into `components/ai/NewAIEmployeeForm.tsx` with no visual changes.
- Authenticated visitors to `/login` and `/signup` are redirected to `/dashboard`; unauthenticated visits to protected routes go to `/login`.
- Extracted redirect decisions into `lib/proxyRouting.ts` with 7 unit tests alongside the existing webhook tests (9 total); `npm audit` reports no vulnerabilities.

## Stabilization completed (data layer slice)

- Consolidated the duplicate create/list flows: the demo form on `/ai-employees` was removed in favor of one creation flow at `/dashboard/ai-employees/new`, which now lands on `/ai-employees/[id]`.
- Added the typed data layer `lib/aiEmployees.ts` covering list, get, create, update, and delete with input validation matching schema constraints; every call runs under the signed-in user's session so RLS scopes all access.
- Added a documented `status` column (`Active`/`Offline`, default `Offline`) to `public.ai_employees`; see the migration in `docs/SUPABASE_SETUP.md`.
- `/ai-employees` now renders real records (error, empty, and loading states included); `/ai-employees/[id]` loads by route ID with not-found handling, and General/Voice/Phone cards persist through the data layer with saving/saved feedback.
- 16 unit tests pass (webhook signatures, proxy routing, data layer against fake clients); RLS-backed integration tests against a live database remain future work.

## Stabilization completed (dashboard and settings persistence slice)

- Dashboard metrics, performance chart, recent calls, appointments table, and the activity feed now read owner-scoped Supabase data through `getDashboardSnapshot` in `lib/dashboard.ts`; fabricated numbers were removed. Empty tables render honest zero/empty states, failures render an error card with retry.
- Added `calls`, `appointments`, and `activity_events` tables plus 17 settings/knowledge columns on `ai_employees`; migration with RLS policies is documented in `docs/SUPABASE_SETUP.md` (must be run before deploying this version).
- General Settings persists department, business description, greeting message, timezone, and working hours; Voice Settings persists accent, speaking style, speed, and tone; Phone Setup persists country, business hours, call forwarding, and routing; Knowledge Base persists website/FAQ/PDF/notes metadata.
- Employee create/delete/go-live events append to `activity_events`, which powers Recent Activity; "WhatsApp activity records" counts real `whatsapp` category rows and does not claim that a message was sent.
- Unit tests extended to 25 (settings validation/persistence + dashboard snapshot derivation); RLS CRUD integration scaffolding added under `tests/integration/` (`npm run test:integration`, skipped without a test project).

## Stabilization completed (WhatsApp inbound processing slice)

- The signed webhook now runs a durable, idempotent pipeline behind a server-only processor boundary (`lib/server/whatsappProcessor.ts`, the only consumer of `SUPABASE_SERVICE_ROLE_KEY`). Valid signatures are always acknowledged 200 with an aggregate summary; failures land on the ledger instead of triggering Meta retry storms.
- New tables `whatsapp_channels`, `conversations`, `messages`, and `webhook_events` with RLS (channels owner-managed; conversations/messages owner read-only; the ledger has zero client policies), unique constraints on Meta's immutable message/event IDs for two-layer deduplication, and indexes for history queries. Migration, retention notes (purge ledger after 7 days via pg_cron), transaction-safety rationale, and rollback SQL are in `docs/SUPABASE_SETUP.md`.
- Event flow: claim in `webhook_events` (`ON CONFLICT DO NOTHING`) → resolve owner by phone number ID → get-or-create `(user_id, customer_wa_id)` conversation → store inbound message → generate reply through the AI provider interface → store outbound draft with status `draft_blocked`. Replayed events count as duplicates; interrupted runs replay through `retryFailedWebhookEvents`.
- Added `lib/ai/provider.ts` with a deterministic offline `MockAIProvider` (no API key required or committed); unknown `AI_PROVIDER` values fall back to the mock safely.
- WhatsApp Setup card now shows server-derived status (webhook configured / inbound ready / outbound blocked by Meta) and links channels into `whatsapp_channels` through the owner's session.
- Unit tests extended to 40 (event parsing, mock AI replies, dedup, ownership resolution, failure/retry, duplicate message IDs); integration scaffold covers messaging-table RLS boundaries. No secrets or customer data are logged anywhere in the pipeline.

## Stabilization completed (conversation inbox slice)

- Added `lib/conversations.ts`, which reads newest conversations and one selected message history through the signed-in user's Supabase session; existing RLS policies enforce ownership and no service-role key is used.
- Added the protected `/conversations` route with sidebar navigation, masked WhatsApp identifiers, inbound/outbound message bubbles, honest `draft_blocked` labels, and loading/empty/error states. Unknown or non-owned IDs never trigger a message query.
- Unit tests extended to 45 with query-shape, empty, unknown-ID, error, and identifier-masking coverage; `/conversations` is covered by proxy routing tests and independently calls `requireAuthenticatedUser()`.

## Stabilization completed (real AI provider slice)

- Added an optional OpenAI Responses API provider with `store: false`, concise business-assistant instructions, bounded replies, and sanitized failures that never expose provider response bodies.
- Provider selection moved to server-only `lib/server/aiProvider.ts`. OpenAI requires explicit `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`; missing or unknown configuration falls back to the deterministic mock without exposing secrets.
- The OpenAI call path has fake-network unit coverage for request shape, storage controls, response extraction, length limits, empty output, and sanitized API failures. No real API key or paid request is used in tests.

## Stabilization completed (delivery receipt slice)

- Meta `delivered`, `read`, and `failed` status callbacks now parse as separate webhook event types with deterministic receipt IDs, so retries deduplicate in the existing ledger.
- Receipt processing resolves the phone-number channel owner, selects only that owner&apos;s matching outbound message, skips unknown channels/messages, and prevents late events from regressing `read` back to `delivered`.
- Failed receipt processing uses the same sanitized ledger retry path as inbound messages. Tests now cover parsing, ownership-scoped updates, monotonic status progression, unknown messages, and duplicate receipts; outbound sending remains disabled.

## Stabilization completed (secure retry endpoint slice)

- Added `POST /api/internal/whatsapp/retry` as a narrow operational wrapper around the existing failed-ledger retry boundary. It accepts no user-selected batch size and processes at most 10 rows per call.
- A separate server-only `WHATSAPP_RETRY_SECRET` of at least 32 characters is required. Missing/weak configuration returns 503, invalid Bearer authentication returns 401, comparisons use fixed-length SHA-256 digests with `timingSafeEqual`, and processor failures return only a generic error.
- Responses disable caching and expose aggregate counts only. Tests cover exact authentication, weak/missing configuration, zero unauthorized side effects, fixed batching, successful aggregates, and sanitized failures.

## Stabilization completed (browser security headers slice)

- Added centrally managed response headers for clickjacking (`X-Frame-Options` plus CSP `frame-ancestors`), MIME sniffing, HSTS, referrer privacy, DNS prefetch, opener isolation, browser permissions, object embedding, base URI, and form action restrictions.
- Every `/api/*` response receives `Cache-Control: no-store`, including webhook and internal recovery responses. The CSP deliberately omits script directives until nonce support is implemented, avoiding a policy that would break Next.js hydration.
- Configuration tests assert the global rule, critical directives, HSTS duration, disabled capabilities, and API cache policy so future changes cannot silently remove the baseline.

## Stabilization completed (webhook request-size protection slice)

- `POST /api/whatsapp/webhook` accepts at most 1 MiB of raw request data before signature verification and processing.
- Oversized declared `Content-Length` values fail immediately; streamed/chunked requests are independently counted so omitting or falsifying that header cannot bypass the cap.
- Oversized payloads receive `413` and unreadable streams receive a sanitized `400`; responses never include secrets or payload contents.
- Unit tests cover valid bodies, declared oversize, real UTF-8 byte counts, and invalid limit configuration.

## Stabilization completed (honest onboarding handoff slice)

- The public onboarding is now clearly a preview: entered business text is capped at 1,000 characters, stays in component memory, and is explicitly described as not saved.
- Removed the unused browser local-storage persistence functions so business information cannot linger unexpectedly on a shared device.
- The final step no longer claims an AI Employee is already operational and no longer renders a zero-data dashboard as if setup succeeded. It accurately sends the visitor to secure signup, where authenticated creation begins.

## Stabilization completed (AI input safety slice)

- Optional OpenAI requests now serialize length-bounded business, employee, knowledge, greeting, and customer fields as untrusted JSON instead of mixing them into a free-form prompt.
- System instructions explicitly reject commands embedded in input data, prompt/secret disclosure attempts, fabricated business facts, and false claims that a payment, booking, order, or account action occurred.
- Provider responses remain capped and non-persistent (`store: false`). Tests include adversarial instruction text and confirm the 4,000-character customer-message boundary.
- Webhook claim failures emit a generic operational log only; customer event IDs and database error details are no longer written to logs.

## Stabilization completed (authentication input safety slice)

- Login and signup normalize email addresses, reject malformed or oversized values before calling Supabase, and cap password input at 128 characters.
- New accounts require a password of at least 12 characters. Forms include explicit autofill metadata and accessible inline error/status feedback instead of browser alerts.
- Supabase provider errors are replaced with generic user-safe messages so account-discovery and backend details are not exposed in the interface.
- Signup redirects to the dashboard only when Supabase returns a real session. Projects requiring email confirmation now show an honest confirmation state instead of entering a protected route prematurely.
- Focused tests cover normalization, malformed/oversized input, and the signup password boundary.

## Stabilization completed (secure account recovery slice)

- Login now links to `/forgot-password`, which sends Supabase recovery mail while returning the same success wording regardless of whether an account exists.
- `/auth/callback` exchanges Supabase's one-time PKCE code for a cookie session. Its destination is allowlisted to `/reset-password`, preventing user-controlled external redirects.
- `/reset-password` independently requires a validated Supabase user, enforces matching 12–128 character passwords, updates the account, and signs out the temporary recovery session after success.
- Provider failures remain generic. Tests cover malicious absolute and protocol-relative redirect attempts plus password boundaries.
- Deployment requires the exact production `/auth/callback` URL in Supabase Authentication's redirect allowlist; localhost should be allowed only for development.

## Stabilization completed (first development-team safety cycle)

- ASTRA hardened the Phase 1 SQL: new employees cannot start Active, direct lifecycle/safety writes are rejected, narrow authorized RPCs own transitions, final-owner changes are serialized, and audit history blocks cascade deletion.
- NOVA removed the legacy status bypass, kept the workspace kill switch available when dashboard metrics fail, replaced the dead deployment control with honest readiness text, and improved responsive dashboard/control layouts.
- CIPHER added regression coverage for missing safety configuration and non-Active employee states. RELAY made WhatsApp drafting fail closed unless the rollout flag is explicitly enabled, the workspace is explicitly unpaused, and a linked employee is both Active and unpaused.
- NEXA PRIME reconciled the app/RPC contracts, removed lifecycle fields from generic settings updates, made cards display the real lifecycle state, and validated lint, typecheck, 90/90 unit tests, and the production build.

## Stabilization completed (operations and tenancy review cycle)

- Added least-privilege GitHub CI with immutable SHA-pinned actions and disabled checkout credential persistence. The locked install, lint, typecheck, unit tests, production build, and high-severity dependency audit are enforced on pushes and pull requests.
- Added a privacy-safe shallow `GET`/`HEAD /api/health` endpoint plus tests and a release/smoke/rollback/incident runbook. Health never claims Supabase, Meta, OpenAI, migration, backup, or outbound readiness.
- Reworked the rollout-gated workspace foundation around an explicit creator-owned personal-workspace identity. Schema/default/key/FK/check/RLS/policy drift aborts; ambiguous legacy ownership aborts; concurrent signup writes are locked through trigger installation; personal membership and ownership identity are immutable.
- Reworked cutover so legacy rows never use an arbitrary/oldest membership. It validates target RLS, policy allowlists, UUID columns, cascade FKs, and uniqueness; backfills only through explicit personal identity; then freezes `workspace_id` and original `user_id` on all seven tenant tables before installing the exact reviewed 14-policy set.
- App workspace and safety resolvers select only the personal owner mapping and use `maybeSingle()` without a limiting query, so duplicate/corrupt identity fails closed.
- CIPHER performed repeated independent reviews until GO with no P0-P2 findings. Final local gates: lint pass, typecheck pass, 95/95 unit tests pass, production build pass, and `npm audit` reports zero vulnerabilities. Integration scaffolding loads but live RLS suites require a dedicated Supabase project and were not claimed as passed.

## Acceleration and closed-beta delivery controls

- Retired the former CEO-plus-six-agent structure. Codex is now the sole controller/reviewer; Kimi, OpenCode, and explicitly approved apps may receive only bounded, secret-free work packets in isolated worktrees. GitHub remains the source of truth and external tools receive no production secrets or direct `main` access.
- Added a privacy-safe closed-beta environment preflight. It requires supported non-placeholder browser-safe Supabase formats, mock AI, explicit false rollout/outbound flags, complete-or-absent WhatsApp inbound configuration, and an optional retry secret of at least 32 characters without printing any configured value. It validates configuration shape and relationships, not provider reachability.
- Added a dependency-free deployment smoke command for root availability, the exact shallow health contract, no-store caching, `HEAD` behavior, and unauthenticated dashboard redirection. Authenticated checks continue manually with synthetic accounts.
- Added a pinned single-Chromium Playwright smoke gate for the built local app. It verifies the exact privacy-safe health response, login availability, and the secret-free fail-closed dashboard boundary; CI installs the browser explicitly and retains no screenshots or traces by default. It does not claim authenticated, database, RLS, or production coverage.
- The critical path remains reproducible Supabase migrations and live RLS proof; isolated Vercel Preview, backup/restore, monitoring and rollback evidence; then an honest setup/test-draft journey. Meta registration continues separately and outbound remains disabled.

## Important limitations

Protected Team Settings and Owner/Admin role updates are implemented behind `TEAM_MANAGEMENT_ENABLED`. Database guards prevent identity-field edits, protect the final Owner, and prevent Admin users from granting/removing Owner. Invitations are intentionally deferred until two-account RLS verification is available.

Employee settings history and restore are implemented behind `EMPLOYEE_VERSION_HISTORY_ENABLED`. History is immutable to browser clients, retained to 50 snapshots, and restored only through a role-checked database function. The code and migration are ready, but live RLS/role/restore evidence is not yet available, so the feature must remain disabled in deployed environments.

Structured Knowledge v0 is implemented behind `KNOWLEDGE_V0_ENABLED`. It supports only bounded notes/FAQs and explicit verification—not uploads, crawling, embeddings, citations, malware scanning, or deletion proof across derived indexes. Live RLS/role evidence is not yet available, so the feature remains disabled in deployed environments.

Workspace-wide automation pause is implemented behind `WORKSPACE_SAFETY_ENABLED`: it defaults paused, is writable only by Owner/Admin through a guarded role-checked RPC, is atomically audited, and is enforced server-side in the WhatsApp processor. While paused, inbound history is still retained but no AI draft is generated. Apply and verify the migration before enabling the control.

Immutable lifecycle audit history is implemented behind `AUDIT_LOG_ENABLED`. A database trigger records status/kill-switch changes atomically with safe metadata; authenticated clients receive read-only workspace-scoped access and cannot insert, edit, or delete audit rows. Apply and verify the audit migration before enabling its UI.

The employee lifecycle implementation now includes validated Draft/Testing/Active/Paused/Archived transitions, an atomic automation pause field, emergency pause UI, and a fail-closed rollout flag. Active transitions require the full evidence checklist. The additive migration deliberately moves legacy Active rows to Paused; controls remain disabled until the migration is applied and `EMPLOYEE_LIFECYCLE_ENABLED=true` is intentionally configured.

The former decorative Deploy card has been replaced with an evidence-based activation checklist covering identity, business behavior, voice/language, knowledge, channel link, signed webhook, inbound runtime, and outbound enablement. Active remains locked even if those visible checks pass because the trusted server writer for fresh activation evidence is not implemented yet.

Phase 1 workspace tenancy, guarded business-table cutover, role management, lifecycle, audit, and kill-switch work is implemented in code but not declared live. Apply the migrations in documented order to a backed-up dedicated Supabase test project, then run two-account RLS/role/bypass checks before enabling any Phase 1 feature flag. Invitations, an explicit active-workspace selector, and stronger cross-workspace relational constraints remain follow-up work.

- A real OpenAI provider is implemented but remains opt-in; production keeps the deterministic mock until server-only `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are intentionally configured. There is still no telephony or booking runtime, so `calls` and `appointments` tables stay empty until those exist.
- Outbound WhatsApp messaging remains disabled pending Meta registration (`WHATSAPP_OUTBOUND_ENABLED=false`); generated replies accumulate as `draft_blocked` messages only. "WhatsApp activity records" on the dashboard counts generic `whatsapp` activity rows, not sent messages.
- Webhook processing runs inline within the request after signature verification; a queue/worker can adopt the same processor boundary later without schema changes.
- The webhook event ledger stores minimal normalized fields so failures can replay; it must be purged regularly (pg_cron snippet in `docs/SUPABASE_SETUP.md`).
- Dashboard "today"/weekly boundaries use the server's local timezone.
- Public onboarding answers are preview-only and intentionally discarded at signup; authenticated AI Employee creation remains the source of truth.
- Unit tests cover signatures, parsing, mock AI, proxy routing, both data modules, and the ingest pipeline against fake clients; RLS-backed integration tests require a dedicated Supabase project and are scaffolded but skipped by default.

## Credential note

Earlier Git history contained browser configuration values. They were moved out of active source. Although Firebase browser keys and Supabase anon/publishable keys are designed for public clients, their permissions still depend on provider restrictions and Supabase RLS. Review restrictions and rotate/revoke any credential if it was ever treated as private. Do not rewrite shared history without coordinating first.
