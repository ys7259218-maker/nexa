# Nexa project recap

## Current state

The repository is an early Next.js 16 App Router application, not a finished production SaaS. Its visual flows are valuable and have been preserved. Authentication, the AI employee CRUD data layer, `/ai-employees`, and `/ai-employees/[id]` use Supabase; dashboard metrics and several settings cards remain demo UI.

### Routes

| Route | State |
| --- | --- |
| `/` | In-memory onboarding flow, then dashboard UI |
| `/login`, `/signup` | Supabase Auth when environment values are configured; signed-in visitors are redirected to `/dashboard` |
| `/dashboard` | Server-side auth gate plus signed-in email/logout; metrics are sample data |
| `/dashboard/ai-employees/new` | Server-side auth gate; creates `ai_employees` records through the typed data layer and lands on the manage page |
| `/ai-employees` | Server-side auth gate; lists the signed-in user's real records with error, empty, and loading states |
| `/ai-employees/[id]` | Server-side auth gate; loads the record by route ID; General/Voice/Phone cards persist name, business, status, voice, language, and phone; delete is wired |
| `/api/whatsapp/webhook` | Meta verification and signature validation; no event processing yet |

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

## Important limitations

- There is no AI model/provider call or agent runtime yet.
- Knowledge base, WhatsApp setup, and deploy actions are UI-only; outbound WhatsApp sending stays disabled pending Meta registration.
- Dashboard metrics are sample data.
- General/Voice/Phone cards persist only the fields that exist in `ai_employees`; their remaining inputs (department, greeting, timezone, accent, country, and similar) are still decorative.
- The onboarding record is local browser storage only.
- Unit tests cover webhook signatures, proxy routing, and the data layer against fake clients; RLS-backed CRUD integration tests against a live database are not established yet.

## Credential note

Earlier Git history contained browser configuration values. They were moved out of active source. Although Firebase browser keys and Supabase anon/publishable keys are designed for public clients, their permissions still depend on provider restrictions and Supabase RLS. Review restrictions and rotate/revoke any credential if it was ever treated as private. Do not rewrite shared history without coordinating first.
