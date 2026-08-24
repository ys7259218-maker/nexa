# Nexa project recap

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
| `/conversations` | Server-side auth gate; real owner-scoped WhatsApp inbox with newest conversations, masked customer identifiers, message history, blocked-draft status, and loading/empty/error states |
| `/api/whatsapp/webhook` | Meta verification, signature validation, and durable idempotent inbound processing (ledger dedup, conversation/message storage, mock-AI draft replies); outbound sending stays disabled |

All four app surfaces under `/dashboard` and `/ai-employees` are protected twice: `proxy.ts` refreshes sessions and redirects unauthenticated requests to `/login`, and each server page independently calls `requireAuthenticatedUser()`.

## Stabilization completed

- Removed hardcoded cloud client configuration from active source and added `.env.example` placeholders.
- Made missing optional configuration fail safely instead of breaking the production build.
- Added a signed WhatsApp webhook boundary without requiring a registered phone number for local development.
- Marked WhatsApp registration and production deployment honestly as pending instead of showing ready.
- Fixed lint failures and added `typecheck`/`check` scripts.
- Added setup, Supabase RLS, WhatsApp blocker, security, and OpenCode handoff documentation.

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
- Employee create/delete/go-live events append to `activity_events`, which powers Recent Activity; "WhatsApp Replies" counts real `whatsapp` category rows (zero until webhook processing ships).
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

## Important limitations

- There is no real AI model call, telephony runtime, or booking runtime yet; inbound WhatsApp events are answered by the deterministic mock provider, and `calls` and `appointments` tables stay empty until those exist.
- Outbound WhatsApp messaging remains disabled pending Meta registration (`WHATSAPP_OUTBOUND_ENABLED=false`); generated replies accumulate as `draft_blocked` messages only. "WhatsApp Replies" on the dashboard counts `whatsapp` activity rows, not sent messages.
- Webhook processing runs inline within the request after signature verification; a queue/worker can adopt the same processor boundary later without schema changes.
- The webhook event ledger stores minimal normalized fields so failures can replay; it must be purged regularly (pg_cron snippet in `docs/SUPABASE_SETUP.md`).
- Dashboard "today"/weekly boundaries use the server's local timezone.
- The onboarding record is local browser storage only; its embedded dashboard preview renders zero-state data.
- Unit tests cover signatures, parsing, mock AI, proxy routing, both data modules, and the ingest pipeline against fake clients; RLS-backed integration tests require a dedicated Supabase project and are scaffolded but skipped by default.

## Credential note

Earlier Git history contained browser configuration values. They were moved out of active source. Although Firebase browser keys and Supabase anon/publishable keys are designed for public clients, their permissions still depend on provider restrictions and Supabase RLS. Review restrictions and rotate/revoke any credential if it was ever treated as private. Do not rewrite shared history without coordinating first.
